import { Router, type IRouter } from "express";
import {
  db,
  groupTrainingsTable,
  trainingBookingsTable,
  usersTable,
  activityLogsTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, gte, lte, ne, sql, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  CreateGroupTrainingBody,
  UpdateGroupTrainingBody,
  ListGroupTrainingsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";
import { sendNotificationEmail } from "../lib/mail";
import { fireAndForget } from "../lib/fireAndForget";

const router: IRouter = Router();
router.use(requireAuth);

const CATEGORIES = ["D-", "D", "D+", "C-", "C", "C+", "B-"] as const;
const CATEGORY_INDEX: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c, i]),
);

// Player levels extend above the training categories. Players at B/B+/A-/A
// are valid and eligible for every category. Returns -1 for unknown levels.
const PLAYER_LEVELS = [
  "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A",
] as const;
const PLAYER_LEVEL_INDEX: Record<string, number> = Object.fromEntries(
  PLAYER_LEVELS.map((l, i) => [l, i]),
);
function playerEligibilityIndex(level: string | null | undefined): number {
  if (!level) return -1;
  return PLAYER_LEVEL_INDEX[level] ?? -1;
}

const UuidSchema = z.string().uuid();

function isCoachRole(role: string): boolean {
  return ["coach", "admin", "owner"].includes(role);
}

function isAdminRole(role: string): boolean {
  return ["admin", "owner"].includes(role);
}

function canManageTraining(
  role: string,
  authUserId: number,
  training: { coachId: number },
): boolean {
  if (isAdminRole(role)) return true;
  if (role === "coach" && training.coachId === authUserId) return true;
  return false;
}

function parseId(raw: unknown): string | null {
  const parsed = UuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function serializeTraining(
  t: typeof groupTrainingsTable.$inferSelect,
  bookedCount: number,
) {
  return {
    id: t.id,
    coachId: t.coachId,
    dateTime: t.dateTime.toISOString(),
    durationMinutes: t.durationMinutes,
    category: t.category,
    courtName: t.courtName,
    courtAddress: t.courtAddress ?? null,
    maxParticipants: t.maxParticipants,
    priceAed: String(t.priceAed),
    descriptionEn: t.descriptionEn ?? null,
    descriptionRu: t.descriptionRu ?? null,
    status: t.status,
    isRecurring: t.isRecurring,
    recurringSeriesId: t.recurringSeriesId ?? null,
    recurringPattern: t.recurringPattern ?? null,
    bookedCount,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serializeBooking(b: typeof trainingBookingsTable.$inferSelect) {
  return {
    id: b.id,
    trainingId: b.trainingId,
    userId: b.userId,
    status: b.status,
    bookedAt: b.bookedAt.toISOString(),
    cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
  };
}

async function countActiveBookings(trainingId: string): Promise<number> {
  const rows = await db
    .select({ id: trainingBookingsTable.id })
    .from(trainingBookingsTable)
    .where(
      and(
        eq(trainingBookingsTable.trainingId, trainingId),
        ne(trainingBookingsTable.status, "cancelled"),
      ),
    );
  return rows.length;
}

async function bookedCountsFor(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const rows = await db
    .select({
      trainingId: trainingBookingsTable.trainingId,
      count: sql<number>`count(*)::int`,
    })
    .from(trainingBookingsTable)
    .where(
      and(
        inArray(trainingBookingsTable.trainingId, ids),
        ne(trainingBookingsTable.status, "cancelled"),
      ),
    )
    .groupBy(trainingBookingsTable.trainingId);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.trainingId] = Number(r.count);
  return map;
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
router.get("/group-trainings", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;

  const qparsed = ListGroupTrainingsQueryParams.safeParse(req.query);
  if (!qparsed.success) {
    res.status(400).json({ error: "Invalid query", details: qparsed.error.issues });
    return;
  }
  const { from, to, category } = qparsed.data;

  const conds = [];
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) conds.push(gte(groupTrainingsTable.dateTime, d));
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) conds.push(lte(groupTrainingsTable.dateTime, d));
  }
  if (category) conds.push(eq(groupTrainingsTable.category, category));

  let rows = await db
    .select()
    .from(groupTrainingsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(groupTrainingsTable.dateTime);

  if (!isCoachRole(role)) {
    const [me] = await db
      .select({ level: usersTable.level })
      .from(usersTable)
      .where(eq(usersTable.id, authUserId));
    // Player must have a known level to view trainings. Levels above the
    // training categories (B, B+, A-, A) are valid players — they see
    // everything (no category is "above" them).
    const PLAYER_LEVELS = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"];
    const hasKnownLevel = !!me && PLAYER_LEVELS.includes(me.level);

    const now = Date.now();
    // Horizon: 30 days so the player page can show a full upcoming list.
    const horizon = now + 1000 * 60 * 60 * 24 * 30;

    // Players see upcoming trainings in scheduled / open / full / closed
    // status. The frontend renders inline labels ("Opens in Xh", "Closed",
    // "Closing in Xh") and marks categories above the player's level as
    // "locked" (request approval).
    const VISIBLE = new Set(["scheduled", "open", "full", "closed"]);
    rows = rows.filter((t) => {
      if (!VISIBLE.has(t.status)) return false;
      const ts = t.dateTime.getTime();
      if (ts < now || ts > horizon) return false;
      if (!hasKnownLevel) return false;
      return true;
    });
  }

  const counts = await bookedCountsFor(rows.map((r) => r.id));
  res.json(rows.map((r) => serializeTraining(r, counts[r.id] ?? 0)));
});

// ─── MY BOOKINGS (must be before /:id) ────────────────────────────────────────
router.get("/group-trainings/me/bookings", async (req, res): Promise<void> => {
  const authUserId: number = (req as any).auth.userId;
  const bookings = await db
    .select()
    .from(trainingBookingsTable)
    .where(eq(trainingBookingsTable.userId, authUserId))
    .orderBy(desc(trainingBookingsTable.bookedAt));

  const trainingIds = [...new Set(bookings.map((b) => b.trainingId))];
  const trainings = trainingIds.length
    ? await db
        .select()
        .from(groupTrainingsTable)
        .where(inArray(groupTrainingsTable.id, trainingIds))
    : [];
  const counts = await bookedCountsFor(trainingIds);
  const trainingMap = new Map(trainings.map((t) => [t.id, t]));

  res.json(
    bookings
      .map((b) => {
        const t = trainingMap.get(b.trainingId);
        if (!t) return null;
        return {
          ...serializeBooking(b),
          training: serializeTraining(t, counts[t.id] ?? 0),
        };
      })
      .filter(Boolean),
  );
});

// ─── DETAIL ───────────────────────────────────────────────────────────────────
router.get("/group-trainings/:id", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }
  const [t] = await db
    .select()
    .from(groupTrainingsTable)
    .where(eq(groupTrainingsTable.id, id));
  if (!t) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Non-coach users: enforce same visibility/category rules as the list.
  // A player may always see a training they have an active booking for,
  // even if it would otherwise be hidden by the level filter.
  if (!isCoachRole(role)) {
    const [me] = await db
      .select({ level: usersTable.level })
      .from(usersTable)
      .where(eq(usersTable.id, authUserId));
    const myIdx = playerEligibilityIndex(me?.level);
    const tIdx = CATEGORY_INDEX[t.category] ?? 99;

    const [activeBooking] = await db
      .select({ id: trainingBookingsTable.id })
      .from(trainingBookingsTable)
      .where(
        and(
          eq(trainingBookingsTable.trainingId, id),
          eq(trainingBookingsTable.userId, authUserId),
          ne(trainingBookingsTable.status, "cancelled"),
        ),
      );

    if (!activeBooking) {
      if (t.status !== "open" && t.status !== "full") {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (myIdx < 0 || tIdx > myIdx) {
        res.status(403).json({ error: "Training category above your level" });
        return;
      }
    }
  }

  res.json(serializeTraining(t, await countActiveBookings(id)));
});

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post("/group-trainings", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }

  const parsed = CreateGroupTrainingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const b = parsed.data;

  const dt = new Date(b.dateTime);
  if (Number.isNaN(dt.getTime())) {
    res.status(400).json({ error: "Invalid dateTime" });
    return;
  }
  if (!CATEGORIES.includes(b.category as (typeof CATEGORIES)[number])) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  const [row] = await db
    .insert(groupTrainingsTable)
    .values({
      coachId: authUserId,
      dateTime: dt,
      durationMinutes: b.durationMinutes ?? 90,
      category: b.category,
      courtName: b.courtName,
      courtAddress: b.courtAddress ?? null,
      maxParticipants: b.maxParticipants ?? 4,
      priceAed: String(b.priceAed),
      descriptionEn: b.descriptionEn ?? null,
      descriptionRu: b.descriptionRu ?? null,
      status: "scheduled",
      isRecurring: !!b.isRecurring,
      recurringPattern: b.recurringPattern ?? null,
    })
    .returning();

  req.log?.info({ trainingId: row.id }, "group_training_created");
  res.status(201).json(serializeTraining(row, 0));
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.patch("/group-trainings/:id", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }

  const [existing] = await db
    .select()
    .from(groupTrainingsTable)
    .where(eq(groupTrainingsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canManageTraining(role, authUserId, existing)) {
    res.status(403).json({ error: "Not your training" });
    return;
  }

  const parsed = UpdateGroupTrainingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const b = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (b.dateTime !== undefined) {
    const dt = new Date(b.dateTime);
    if (Number.isNaN(dt.getTime())) {
      res.status(400).json({ error: "Invalid dateTime" });
      return;
    }
    update.dateTime = dt;
  }
  if (b.durationMinutes !== undefined) update.durationMinutes = b.durationMinutes;
  if (b.category !== undefined) update.category = b.category;
  if (b.courtName !== undefined) update.courtName = b.courtName;
  if (b.courtAddress !== undefined) update.courtAddress = b.courtAddress;
  if (b.maxParticipants !== undefined) update.maxParticipants = b.maxParticipants;
  if (b.priceAed !== undefined) update.priceAed = String(b.priceAed);
  if (b.descriptionEn !== undefined) update.descriptionEn = b.descriptionEn;
  if (b.descriptionRu !== undefined) update.descriptionRu = b.descriptionRu;
  if (b.isRecurring !== undefined) update.isRecurring = b.isRecurring;
  if (b.recurringPattern !== undefined) update.recurringPattern = b.recurringPattern;
  if (b.status !== undefined) update.status = b.status;

  const [row] = await db
    .update(groupTrainingsTable)
    .set(update)
    .where(eq(groupTrainingsTable.id, id))
    .returning();
  res.json(serializeTraining(row, await countActiveBookings(id)));
});

// ─── CANCEL (DELETE) ──────────────────────────────────────────────────────────
router.delete("/group-trainings/:id", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }
  const [existing] = await db
    .select()
    .from(groupTrainingsTable)
    .where(eq(groupTrainingsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canManageTraining(role, authUserId, existing)) {
    res.status(403).json({ error: "Not your training" });
    return;
  }
  // Snapshot affected users BEFORE we cascade-cancel their bookings so we
  // can notify them.
  const affected = await db
    .select({
      bookingId: trainingBookingsTable.id,
      userId: trainingBookingsTable.userId,
      email: usersTable.email,
      name: usersTable.name,
    })
    .from(trainingBookingsTable)
    .innerJoin(usersTable, eq(usersTable.id, trainingBookingsTable.userId))
    .where(
      and(
        eq(trainingBookingsTable.trainingId, id),
        ne(trainingBookingsTable.status, "cancelled"),
      ),
    );

  const [row] = await db
    .update(groupTrainingsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(groupTrainingsTable.id, id))
    .returning();

  await db
    .update(trainingBookingsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(trainingBookingsTable.trainingId, id),
        ne(trainingBookingsTable.status, "cancelled"),
      ),
    );

  // Notify each affected player: activity-log entry + in-app notification + email.
  if (affected.length > 0) {
    await db.insert(activityLogsTable).values(
      affected.map((a) => ({
        userId: a.userId,
        userName: a.name,
        action: "training_cancelled_notify",
        details: `Group training ${id} (${existing.category}, ${existing.courtName}) was cancelled by the coach.`,
      })),
    );

    const whenStr = existing.dateTime.toISOString();
    await db
      .insert(notificationsTable)
      .values(
        affected.map((a) => ({
          userId: a.userId,
          kind: "training_cancelled_by_coach",
          trainingId: id,
          titleEn: "Training cancelled",
          titleRu: "Тренировка отменена",
          bodyEn: `${existing.category} at ${existing.courtName} on ${whenStr} was cancelled by the coach.`,
          bodyRu: `${existing.category} — ${existing.courtName}, ${whenStr} отменена тренером.`,
          link: `/group-trainings/${id}`,
        })),
      )
      .onConflictDoNothing({
        target: [
          notificationsTable.userId,
          notificationsTable.kind,
          notificationsTable.trainingId,
        ],
      });

    const when = existing.dateTime.toISOString();
    const subject = `Group training cancelled / Тренировка отменена — ${existing.courtName}`;
    for (const a of affected) {
      if (!a.email) continue;
      const html = `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#000;color:#e8eaf0;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#0f1520;border:1px solid #1e2a40;border-radius:16px;padding:32px;">
<h2 style="color:#D4AF37;margin:0 0 16px;">Тренировка отменена</h2>
<p>Привет, ${a.name}!</p>
<p>К сожалению, групповая тренировка <strong>${existing.courtName}</strong> (${existing.category}) на ${when} была отменена тренером. Если ты оплатил место, мы вернём средства.</p>
<hr style="border:none;border-top:1px solid #1e2a40;margin:24px 0;"/>
<h3 style="color:#D4AF37;margin:0 0 12px;">Training cancelled</h3>
<p>Hi ${a.name},</p>
<p>The group training <strong>${existing.courtName}</strong> (${existing.category}) on ${when} has been cancelled by the coach. If you've paid, we'll refund your spot.</p>
</div></body></html>`;
      fireAndForget(
        sendNotificationEmail(a.email, subject, html),
        { trainingId: id, userId: a.userId, kind: "training_cancellation_email" },
      );
    }
  }

  req.log?.info(
    { trainingId: id, notified: affected.length },
    "group_training_cancelled",
  );
  res.json(serializeTraining(row, 0));
});

// ─── BOOK ─────────────────────────────────────────────────────────────────────
router.post("/group-trainings/:id/book", async (req, res): Promise<void> => {
  const authUserId: number = (req as any).auth.userId;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }

  const [training] = await db
    .select()
    .from(groupTrainingsTable)
    .where(eq(groupTrainingsTable.id, id));
  if (!training) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [me] = await db
    .select({ level: usersTable.level, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, authUserId));
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const myIdx = playerEligibilityIndex(me.level);
  const tIdx = CATEGORY_INDEX[training.category] ?? 99;
  // Task #137: standardize LEVEL_REQUIRED error code
  if (!me.level || myIdx < 0) {
    res.status(400).json({
      error: "Please set your padel level before booking a training.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }
  if (tIdx > myIdx) {
    res.status(403).json({
      error: "Training category above your level",
      code: "LEVEL_TOO_HIGH",
      category: training.category,
      yourLevel: me.level,
    });
    return;
  }

  const txResult = await db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`SELECT id, max_participants, status FROM group_trainings WHERE id = ${id} FOR UPDATE`,
    );
    const lockedRow = (locked as any).rows?.[0];
    if (!lockedRow) return { kind: "notfound" as const };
    if (lockedRow.status === "cancelled" || lockedRow.status === "completed") {
      return { kind: "not_bookable" as const };
    }
    // Registration window: only 'open' (and 'full' which transitions on its own) is bookable.
    if (lockedRow.status === "scheduled") {
      return { kind: "not_open_yet" as const };
    }
    if (lockedRow.status === "closed") {
      return { kind: "closed" as const };
    }

    const existing = await tx
      .select({ id: trainingBookingsTable.id })
      .from(trainingBookingsTable)
      .where(
        and(
          eq(trainingBookingsTable.trainingId, id),
          eq(trainingBookingsTable.userId, authUserId),
          ne(trainingBookingsTable.status, "cancelled"),
        ),
      );
    if (existing.length > 0) return { kind: "already" as const };

    const countRows = await tx
      .select({ id: trainingBookingsTable.id })
      .from(trainingBookingsTable)
      .where(
        and(
          eq(trainingBookingsTable.trainingId, id),
          ne(trainingBookingsTable.status, "cancelled"),
        ),
      );
    const count = countRows.length;
    const max = Number(lockedRow.max_participants);
    if (count >= max) {
      if (lockedRow.status !== "full") {
        await tx
          .update(groupTrainingsTable)
          .set({ status: "full", updatedAt: new Date() })
          .where(eq(groupTrainingsTable.id, id));
      }
      return { kind: "full" as const };
    }

    const [booking] = await tx
      .insert(trainingBookingsTable)
      .values({ trainingId: id, userId: authUserId, status: "booked" })
      .returning();

    if (count + 1 >= max) {
      await tx
        .update(groupTrainingsTable)
        .set({ status: "full", updatedAt: new Date() })
        .where(eq(groupTrainingsTable.id, id));
    }
    return { kind: "ok" as const, booking };
  });

  if (txResult.kind === "notfound") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (txResult.kind === "not_bookable") {
    res.status(409).json({ error: "Training is not bookable", full: false });
    return;
  }
  if (txResult.kind === "not_open_yet") {
    res.status(409).json({ error: "Registration not open yet", reason: "scheduled" });
    return;
  }
  if (txResult.kind === "closed") {
    res.status(409).json({ error: "Registration closed", reason: "closed" });
    return;
  }
  if (txResult.kind === "already") {
    res.status(409).json({ error: "Already booked", alreadyBooked: true });
    return;
  }
  if (txResult.kind === "full") {
    res.status(409).json({ error: "Training is full", full: true });
    return;
  }

  await db.insert(activityLogsTable).values({
    userId: authUserId,
    userName: me.name,
    action: "training_booked",
    details: `Booked group training ${id} (${training.category})`,
  });

  res.status(201).json(serializeBooking(txResult.booking));
});

// ─── CANCEL OWN BOOKING ───────────────────────────────────────────────────────
router.delete("/group-trainings/:id/booking", async (req, res): Promise<void> => {
  const authUserId: number = (req as any).auth.userId;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }

  const txResult = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM group_trainings WHERE id = ${id} FOR UPDATE`,
    );
    const [existing] = await tx
      .select()
      .from(trainingBookingsTable)
      .where(
        and(
          eq(trainingBookingsTable.trainingId, id),
          eq(trainingBookingsTable.userId, authUserId),
          ne(trainingBookingsTable.status, "cancelled"),
        ),
      );
    if (!existing) return { kind: "notfound" as const };

    const [row] = await tx
      .update(trainingBookingsTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(trainingBookingsTable.id, existing.id))
      .returning();

    const [t] = await tx
      .select()
      .from(groupTrainingsTable)
      .where(eq(groupTrainingsTable.id, id));
    if (t && t.status === "full") {
      await tx
        .update(groupTrainingsTable)
        .set({ status: "open", updatedAt: new Date() })
        .where(eq(groupTrainingsTable.id, id));
    }
    return { kind: "ok" as const, row };
  });

  if (txResult.kind === "notfound") {
    res.status(404).json({ error: "No active booking" });
    return;
  }
  res.json(serializeBooking(txResult.row));
});

// ─── COACH VIEW OF BOOKINGS ───────────────────────────────────────────────────
router.get("/group-trainings/:id/bookings", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }

  const [training] = await db
    .select()
    .from(groupTrainingsTable)
    .where(eq(groupTrainingsTable.id, id));
  if (!training) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canManageTraining(role, authUserId, training)) {
    res.status(403).json({ error: "Not your training" });
    return;
  }

  const rows = await db
    .select()
    .from(trainingBookingsTable)
    .where(eq(trainingBookingsTable.trainingId, id))
    .orderBy(trainingBookingsTable.bookedAt);

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const players = userIds.length
    ? await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          phone: usersTable.phone,
          level: usersTable.level,
          avatar: usersTable.avatar,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
    : [];
  const playerMap = new Map(players.map((p) => [p.id, p]));

  res.json(
    rows.map((r) => {
      const p = playerMap.get(r.userId);
      return {
        ...serializeBooking(r),
        player: p
          ? {
              id: p.id,
              name: p.name,
              email: p.email,
              phone: p.phone,
              level: p.level,
              avatar: p.avatar ?? null,
            }
          : null,
      };
    }),
  );
});

export default router;
