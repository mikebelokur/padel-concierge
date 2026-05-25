import { db, usersTable } from "@workspace/db";
import { isNull, lt, sql } from "drizzle-orm";
import { sendSetupReminderEmail } from "./mail";
import { logger } from "./logger";

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

        logger.info({ userId: user.id, email: user.email }, "reminderJob: reminder sent and timestamp saved");
      } else {
        logger.warn({ userId: user.id, email: user.email }, "reminderJob: email not delivered — will retry next run");
      }
    } catch (err) {
      logger.error({ err, userId: user.id }, "reminderJob: failed to send reminder");
    }
  }
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
