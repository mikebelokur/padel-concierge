import { db, usersTable, reminderLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendSetupReminderEmail } from "./mail";
import { logger } from "./logger";

export const REMINDER_COOLDOWN_HOURS = 48;
export const REMINDER_MAX_TOTAL = 5;

export type ReminderBlockReason = "cooldown" | "max_reached";

export type ReminderEligibility =
  | { canSend: true; remaining: number; nextAllowedAt: null; reason: null }
  | { canSend: false; remaining: number; nextAllowedAt: Date | null; reason: ReminderBlockReason };

export function getReminderEligibility(lastSentAt: Date | null, count: number, now: Date = new Date()): ReminderEligibility {
  const remaining = Math.max(0, REMINDER_MAX_TOTAL - count);
  if (count >= REMINDER_MAX_TOTAL) {
    return { canSend: false, remaining: 0, nextAllowedAt: null, reason: "max_reached" };
  }
  if (lastSentAt) {
    const next = new Date(lastSentAt.getTime() + REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);
    if (next.getTime() > now.getTime()) {
      return { canSend: false, remaining, nextAllowedAt: next, reason: "cooldown" };
    }
  }
  return { canSend: true, remaining, nextAllowedAt: null, reason: null };
}

async function logReminder(userId: number, triggeredBy: "auto" | "manual", senderUserId: number | null, delivered: boolean): Promise<void> {
  try {
    await db.insert(reminderLogsTable).values({ userId, triggeredBy, senderUserId, delivered });
  } catch (err) {
    logger.error({ err, userId }, "reminderJob: failed to write reminder log");
  }
}

async function getReminderCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reminderLogsTable)
    .where(eq(reminderLogsTable.userId, userId));
  return row?.count ?? 0;
}

const INTERVAL_MS = 60 * 60 * 1000;
const CUTOFF_HOURS = 24;

async function runReminderJob(): Promise<void> {
  logger.info("reminderJob: checking for users needing setup reminder");

  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000);

  let candidates: Array<{ id: number; email: string; name: string; reminderSentAt: Date | null }>;
  try {
    candidates = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        reminderSentAt: usersTable.reminderSentAt,
      })
      .from(usersTable)
      .where(
        sql`${usersTable.archetype} IS NULL
        AND ${usersTable.createdAt} < ${cutoff.toISOString()}
        AND ${usersTable.role} = 'player'
        AND ${usersTable.reminderOptOut} = false`
      );
  } catch (err) {
    logger.error({ err }, "reminderJob: DB query failed");
    return;
  }

  if (candidates.length === 0) {
    logger.info("reminderJob: no candidate users");
    return;
  }

  let eligible: typeof candidates = [];
  let blockedCooldown = 0;
  let blockedCap = 0;

  for (const user of candidates) {
    const count = await getReminderCount(user.id);
    const status = getReminderEligibility(user.reminderSentAt, count);
    if (status.canSend) {
      eligible.push(user);
    } else if (status.reason === "cooldown") {
      blockedCooldown++;
    } else {
      blockedCap++;
    }
  }

  if (eligible.length === 0) {
    logger.info({ blockedCooldown, blockedCap }, "reminderJob: no eligible users after cooldown/cap");
    return;
  }

  logger.info({ count: eligible.length, blockedCooldown, blockedCap }, "reminderJob: sending reminders");

  for (const user of eligible) {
    try {
      const result = await sendSetupReminderEmail(user.email, user.name);

      if (result.sent) {
        await db
          .update(usersTable)
          .set({ reminderSentAt: new Date() })
          .where(sql`${usersTable.id} = ${user.id}`);

        await logReminder(user.id, "auto", null, true);
        logger.info({ userId: user.id, email: user.email }, "reminderJob: reminder sent and timestamp saved");
      } else {
        logger.warn({ userId: user.id, email: user.email }, "reminderJob: email not delivered — will retry next run");
      }
    } catch (err) {
      logger.error({ err, userId: user.id }, "reminderJob: failed to send reminder");
    }
  }
}

export type SendReminderResult = {
  sent: boolean;
  alreadyDone: boolean;
  blocked: null | { reason: ReminderBlockReason; nextAllowedAt: string | null; remaining: number };
};

export async function sendReminderToUser(userId: number, senderUserId: number | null = null): Promise<SendReminderResult> {
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role, archetype: usersTable.archetype, reminderSentAt: usersTable.reminderSentAt, reminderOptOut: usersTable.reminderOptOut })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) throw new Error("User not found");
  if (user.role !== "player") throw new Error("Reminders can only be sent to players");
  if (user.archetype !== null) return { sent: false, alreadyDone: true, blocked: null };
  if (user.reminderOptOut) return { sent: false, alreadyDone: true, blocked: null };

  const count = await getReminderCount(userId);
  const eligibility = getReminderEligibility(user.reminderSentAt, count);
  if (!eligibility.canSend) {
    return {
      sent: false,
      alreadyDone: false,
      blocked: {
        reason: eligibility.reason,
        nextAllowedAt: eligibility.nextAllowedAt?.toISOString() ?? null,
        remaining: eligibility.remaining,
      },
    };
  }

  const result = await sendSetupReminderEmail(user.email, user.name);

  if (result.sent) {
    await db
      .update(usersTable)
      .set({ reminderSentAt: new Date() })
      .where(eq(usersTable.id, userId));
    await logReminder(userId, "manual", senderUserId, true);
    logger.info({ userId, email: user.email }, "reminderJob: manual reminder sent");
  }

  return { sent: result.sent, alreadyDone: false, blocked: null };
}

export function startReminderJob(): void {
  runReminderJob().catch((err: unknown) => {
    logger.error({ err }, "reminderJob: initial run failed");
  });

  setInterval(() => {
    runReminderJob().catch((err: unknown) => {
      logger.error({ err }, "reminderJob: scheduled run failed");
    });
  }, INTERVAL_MS).unref();

  logger.info({ intervalMs: INTERVAL_MS, cutoffHours: CUTOFF_HOURS, cooldownHours: REMINDER_COOLDOWN_HOURS, maxTotal: REMINDER_MAX_TOTAL }, "reminderJob: scheduled");
}
