import { Router, type IRouter } from "express";
import {
  db,
  groupTrainingsTable,
  trainingBookingsTable,
  usersTable,
  activityLogsTable,
} from "@workspace/db";
import { and, eq, gte, lte, ne, sql, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  CreateGroupTrainingBody,
  UpdateGroupTrainingBody,
  ListGroupTrainingsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

const CATEGORIES = ["D-", "D", "D+", "C-", "C", "C+", "B-"] as const;
const CATEGORY_INDEX: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c, i]),
);

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
    const myIdx = me ? (CATEGORY_INDEX[me.level] ?? -1) : -1;

    const now = Date.now();
    const horizon = now + 1000 * 60 * 60 * 24 * 2;

    rows = rows.filter((t) => {
      if (t.status !== "open" && t.status !== "full") return false;
      const ts = t.dateTime.getTime();
      if (ts < now || ts > horizon) return false;
      const tIdx = CATEGORY_INDEX[t.category] ?? 99;
      return myIdx >= 0 && tIdx <= myIdx;
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
      status: "open",
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

  req.log?.info({ trainingId: id }, "group_training_cancelled");
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
  const myIdx = CATEGORY_INDEX[me.level] ?? -1;
  const tIdx = CATEGORY_INDEX[training.category] ?? 99;
  if (myIdx < 0 || tIdx > myIdx) {
    res
      .status(403)
      .json({ error: "Training category above your level", category: training.category });
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
