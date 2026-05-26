import {
  db,
  groupTrainingsTable,
  trainingBookingsTable,
  recurringSeriesTable,
  notificationsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, lte, ne, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";

const PLAYER_LEVELS = [
  "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A",
] as const;
const PLAYER_LEVEL_INDEX: Record<string, number> = Object.fromEntries(
  PLAYER_LEVELS.map((l, i) => [l, i]),
);
const CATEGORY_INDEX: Record<string, number> = {
  "D-": 0, "D": 1, "D+": 2, "C-": 3, "C": 4, "C+": 5, "B-": 6,
};

const ROLL_DAYS = 14;

function nextDateForWeekday(from: Date, weekday: number, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map((s) => parseInt(s, 10));
  const d = new Date(from);
  d.setHours(hh ?? 0, mm ?? 0, 0, 0);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  if (d.getTime() < from.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

export interface TickResult {
  generated: number;
  notified: number;
}

export async function runGroupTrainingTick(): Promise<TickResult> {
  const generated = await generateRecurringInstances();
  await transitionRegistrationWindows();
  const notified = await dispatchNotifications();
  return { generated, notified };
}

/**
 * Auto-transition registration windows:
 *   scheduled → open    when starts in ≤ 48h
 *   open      → closed  when starts in ≤ 12h
 * Triggers a per-user session-open email (reusing 12h cooldown) on
 * scheduled→open transitions via dispatchSessionOpenEmails().
 */
async function transitionRegistrationWindows(): Promise<void> {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  // scheduled → open (48h window opens)
  const opened = await db
    .update(groupTrainingsTable)
    .set({ status: "open", updatedAt: now })
    .where(
      and(
        eq(groupTrainingsTable.status, "scheduled"),
        lte(groupTrainingsTable.dateTime, in48h),
        gte(groupTrainingsTable.dateTime, now),
      ),
    )
    .returning({ id: groupTrainingsTable.id, category: groupTrainingsTable.category, dateTime: groupTrainingsTable.dateTime, courtName: groupTrainingsTable.courtName });

  if (opened.length > 0) {
    logger.info({ count: opened.length, ids: opened.map((o) => o.id) }, "groupTrainingScheduler: opened registration");
    // Dispatch session-open emails (Task D — defined in sessionOpenMailer)
    try {
      const mod = await import("./sessionOpenMailer");
      for (const t of opened) await mod.dispatchSessionOpenEmails(t);
    } catch (err) {
      logger.error({ err }, "sessionOpenMailer: dispatch failed");
    }
  }

  // open → closed (12h window closes; full stays full)
  const closed = await db
    .update(groupTrainingsTable)
    .set({ status: "closed", updatedAt: now })
    .where(
      and(
        eq(groupTrainingsTable.status, "open"),
        lte(groupTrainingsTable.dateTime, in12h),
        gte(groupTrainingsTable.dateTime, now),
      ),
    )
    .returning({ id: groupTrainingsTable.id });

  if (closed.length > 0) {
    logger.info({ count: closed.length, ids: closed.map((c) => c.id) }, "groupTrainingScheduler: closed registration");
  }
}

async function generateRecurringInstances(): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + ROLL_DAYS * 24 * 60 * 60 * 1000);

  const series = await db
    .select()
    .from(recurringSeriesTable)
    .where(eq(recurringSeriesTable.active, true));

  let created = 0;
  for (const s of series) {
    // untilDate is a `date` (YYYY-MM-DD). Treat it as inclusive end-of-day
    // so that an occurrence later in the day is still produced.
    const untilEnd = s.untilDate
      ? new Date(`${s.untilDate}T23:59:59.999Z`)
      : null;
    if (untilEnd && untilEnd < now) continue;

    const occurrences: Date[] = [];
    let cursor = nextDateForWeekday(now, s.weekday, s.startTime);
    while (cursor.getTime() <= horizon.getTime()) {
      if (untilEnd && cursor.getTime() > untilEnd.getTime()) break;
      occurrences.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    if (occurrences.length === 0) continue;

    const existing = await db
      .select({ dateTime: groupTrainingsTable.dateTime })
      .from(groupTrainingsTable)
      .where(
        and(
          eq(groupTrainingsTable.recurringSeriesId, s.id),
          gte(groupTrainingsTable.dateTime, now),
          lte(groupTrainingsTable.dateTime, horizon),
        ),
      );
    const existingSet = new Set(existing.map((e) => e.dateTime.getTime()));

    const toInsert = occurrences
      .filter((d) => !existingSet.has(d.getTime()))
      .map((dt) => ({
        coachId: s.coachId,
        dateTime: dt,
        durationMinutes: s.durationMinutes,
        category: s.category,
        courtName: s.courtName,
        courtAddress: s.courtAddress ?? null,
        maxParticipants: s.maxParticipants,
        priceAed: String(s.priceAed),
        descriptionEn: s.descriptionEn ?? null,
        descriptionRu: s.descriptionRu ?? null,
        status: "scheduled" as const,
        isRecurring: true,
        recurringSeriesId: s.id,
        recurringPattern: `WEEKLY:${s.weekday}:${s.startTime}`,
      }));

    if (toInsert.length > 0) {
      const inserted = await db
        .insert(groupTrainingsTable)
        .values(toInsert)
        .onConflictDoNothing({
          target: [
            groupTrainingsTable.recurringSeriesId,
            groupTrainingsTable.dateTime,
          ],
        })
        .returning({ id: groupTrainingsTable.id });
      created += inserted.length;
    }
  }
  return created;
}

async function dispatchNotifications(): Promise<number> {
  const now = new Date();
  const in2d = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const trainings = await db
    .select()
    .from(groupTrainingsTable)
    .where(
      and(
        gte(groupTrainingsTable.dateTime, now),
        lte(groupTrainingsTable.dateTime, in30d),
        inArray(groupTrainingsTable.status, ["open", "full"]),
      ),
    );

  let notified = 0;

  for (const t of trainings) {
    const startMs = t.dateTime.getTime();
    const nowMs = now.getTime();
    const hoursUntil = (startMs - nowMs) / (1000 * 60 * 60);

    // ── training_open: 2d window (24–48h before) — all category-eligible players
    if (hoursUntil > 24 && hoursUntil <= 48) {
      const eligible = await db
        .select({ id: usersTable.id, level: usersTable.level })
        .from(usersTable)
        .where(and(eq(usersTable.role, "player")));
      const tIdx = CATEGORY_INDEX[t.category] ?? 99;
      const rows = eligible
        .filter((u) => {
          const lvl = u.level ? PLAYER_LEVEL_INDEX[u.level] ?? -1 : -1;
          return lvl >= 0 && tIdx <= lvl;
        })
        .map((u) => ({
          userId: u.id,
          kind: "training_open",
          trainingId: t.id,
          titleEn: `Training opens in 2 days`,
          titleRu: `Тренировка через 2 дня`,
          bodyEn: `${t.category} at ${t.courtName} on ${t.dateTime.toISOString()}. Reserve your spot.`,
          bodyRu: `${t.category} — ${t.courtName}, ${t.dateTime.toISOString()}. Забронируй место.`,
          link: `/group-trainings/${t.id}`,
        }));
      notified += await bulkInsertNotifications(rows);
    }

    // ── training_tomorrow: 12–24h before evening → booked players only
    if (hoursUntil > 12 && hoursUntil <= 24) {
      const booked = await activeBookedUserIds(t.id);
      const rows = booked.map((userId) => ({
        userId,
        kind: "training_tomorrow",
        trainingId: t.id,
        titleEn: `Training tomorrow`,
        titleRu: `Тренировка завтра`,
        bodyEn: `Don't forget: ${t.category} at ${t.courtName}, ${t.dateTime.toISOString()}.`,
        bodyRu: `Не забудь: ${t.category} — ${t.courtName}, ${t.dateTime.toISOString()}.`,
        link: `/group-trainings/${t.id}`,
      }));
      notified += await bulkInsertNotifications(rows);
    }

    // ── training_cancel_deadline: 12h before (window 10–13h) — booked players
    if (hoursUntil > 10 && hoursUntil <= 13) {
      const booked = await activeBookedUserIds(t.id);
      const rows = booked.map((userId) => ({
        userId,
        kind: "training_cancel_deadline",
        trainingId: t.id,
        titleEn: `Last chance to cancel (12h)`,
        titleRu: `Последний шанс отменить (12ч)`,
        bodyEn: `If you can't make it to ${t.courtName}, cancel now to free the spot.`,
        bodyRu: `Если не сможешь прийти на ${t.courtName}, отмени сейчас, чтобы освободить место.`,
        link: `/group-trainings/${t.id}`,
      }));
      notified += await bulkInsertNotifications(rows);
    }

    // ── training_hour: 1h before (window 30–90min) — booked players.
    // Wider than 1h so a missed tick (or longer outage) still fires once.
    if (hoursUntil > 0.5 && hoursUntil <= 1.5) {
      const booked = await activeBookedUserIds(t.id);
      const rows = booked.map((userId) => ({
        userId,
        kind: "training_hour",
        trainingId: t.id,
        titleEn: `Training starts in 1 hour`,
        titleRu: `Тренировка через час`,
        bodyEn: `${t.category} at ${t.courtName}. See you on court!`,
        bodyRu: `${t.category} — ${t.courtName}. Увидимся на корте!`,
        link: `/group-trainings/${t.id}`,
      }));
      notified += await bulkInsertNotifications(rows);
    }
  }

  return notified;
}

async function activeBookedUserIds(trainingId: string): Promise<number[]> {
  const rows = await db
    .select({ userId: trainingBookingsTable.userId })
    .from(trainingBookingsTable)
    .where(
      and(
        eq(trainingBookingsTable.trainingId, trainingId),
        ne(trainingBookingsTable.status, "cancelled"),
      ),
    );
  return rows.map((r) => r.userId);
}

async function bulkInsertNotifications(
  rows: Array<{
    userId: number;
    kind: string;
    trainingId: string | null;
    titleEn: string;
    titleRu: string;
    bodyEn: string;
    bodyRu: string;
    link: string | null;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    const inserted = await db
      .insert(notificationsTable)
      .values(rows)
      .onConflictDoNothing({
        target: [
          notificationsTable.userId,
          notificationsTable.kind,
          notificationsTable.trainingId,
        ],
      })
      .returning({ id: notificationsTable.id });
    return inserted.length;
  } catch (err) {
    logger.error({ err }, "bulkInsertNotifications: failed");
    return 0;
  }
}

const TICK_INTERVAL_MS = 15 * 60 * 1000;

export function startGroupTrainingScheduler(): void {
  runGroupTrainingTick()
    .then((r) => logger.info(r, "groupTrainingScheduler: initial tick"))
    .catch((err) => logger.error({ err }, "groupTrainingScheduler: initial failed"));
  setInterval(() => {
    runGroupTrainingTick()
      .then((r) => logger.info(r, "groupTrainingScheduler: tick"))
      .catch((err) => logger.error({ err }, "groupTrainingScheduler: failed"));
  }, TICK_INTERVAL_MS).unref();
  logger.info({ intervalMs: TICK_INTERVAL_MS }, "groupTrainingScheduler: scheduled");
}
