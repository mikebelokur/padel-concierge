import { db, usersTable, reminderLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendSetupReminderEmail } from "./mail";
import { logger } from "./logger";

async function logReminder(userId: number, triggeredBy: "auto" | "manual", senderUserId: number | null, delivered: boolean): Promise<void> {
  try {
    await db.insert(reminderLogsTable).values({ userId, triggeredBy, senderUserId, delivered });
  } catch (err) {
    logger.error({ err, userId }, "reminderJob: failed to write reminder log");
  }
}

const INTERVAL_MS = 60 * 60 * 1000;
const CUTOFF_HOURS = 24;

async function runReminderJob(): Promise<void> {
  logger.info("reminderJob: checking for users needing setup reminder");

  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000);

  let eligible: Array<{ id: number; email: string; name: string }>;
  try {
    eligible = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(
        sql`${usersTable.archetype} IS NULL
        AND ${usersTable.reminderSentAt} IS NULL
        AND ${usersTable.createdAt} < ${cutoff.toISOString()}
        AND ${usersTable.role} = 'player'`
      );
  } catch (err) {
    logger.error({ err }, "reminderJob: DB query failed");
    return;
  }

  if (eligible.length === 0) {
    logger.info("reminderJob: no eligible users");
    return;
  }

  logger.info({ count: eligible.length }, "reminderJob: sending reminders");

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

export async function sendReminderToUser(userId: number, senderUserId: number | null = null): Promise<{ sent: boolean; alreadyDone: boolean }> {
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role, archetype: usersTable.archetype, reminderSentAt: usersTable.reminderSentAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) throw new Error("User not found");
  if (user.role !== "player") throw new Error("Reminders can only be sent to players");
  if (user.archetype !== null) return { sent: false, alreadyDone: true };

  const result = await sendSetupReminderEmail(user.email, user.name);

  if (result.sent) {
    await db
      .update(usersTable)
      .set({ reminderSentAt: new Date() })
      .where(eq(usersTable.id, userId));
    await logReminder(userId, "manual", senderUserId, true);
    logger.info({ userId, email: user.email }, "reminderJob: manual reminder sent");
  }

  return { sent: result.sent, alreadyDone: false };
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

  logger.info({ intervalMs: INTERVAL_MS, cutoffHours: CUTOFF_HOURS }, "reminderJob: scheduled");
}
