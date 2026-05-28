import { Router, type IRouter } from "express";
import {
  db,
  clubSlotsTable,
  slotInterestsTable,
  clubsTable,
  usersTable,
  matchesTable,
  bookingsTable,
  activityLogsTable,
} from "@workspace/db";
import { and, eq, gt, gte, inArray, asc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth";
import { getTokenFromRequest, verifyToken } from "../lib/auth";
import { sendPushToUser } from "../lib/push";

const router: IRouter = Router();
router.use(requireAuth);

type SlotRow = typeof clubSlotsTable.$inferSelect;

function serializeSlot(s: SlotRow, interestedUserIds: number[] = []) {
  return {
    id: s.id,
    clubId: s.clubId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    courtNumber: s.courtNumber ?? null,
    priceAed: s.priceAed ?? null,
    levelSuitability: s.levelSuitability ?? null,
    notes: s.notes ?? null,
    status: s.status,
    recurringSeriesId: s.recurringSeriesId ?? null,
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    interestedUserIds,
    interestedCount: interestedUserIds.length,
  };
}

async function isAdmin(req: import("express").Request): Promise<boolean> {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return false;
  const [u] = await db
    .select({ modeAdmin: usersTable.modeAdmin, modeDeveloper: usersTable.modeDeveloper })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  return !!(u?.modeAdmin || u?.modeDeveloper);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadInterests(slotIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (slotIds.length === 0) return map;
  const rows = await db
    .select({ slotId: slotInterestsTable.slotId, userId: slotInterestsTable.userId })
    .from(slotInterestsTable)
    .where(inArray(slotInterestsTable.slotId, slotIds));
  for (const r of rows) {
    const arr = map.get(r.slotId) ?? [];
    arr.push(r.userId);
    map.set(r.slotId, arr);
  }
  return map;
}

// List slots for a club. Players see only upcoming open slots; admins see all (with ?includeAll=true and optional ?date=).
router.get("/clubs/:id/slots", async (req, res): Promise<void> => {
  const clubId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(clubId)) {
    res.status(400).json({ error: "Invalid club id" });
    return;
  }
  const includeAll = String(req.query.includeAll ?? "false") === "true" && (await isAdmin(req));
  const dateFilter = typeof req.query.date === "string" ? req.query.date : undefined;

  const where = includeAll
    ? dateFilter
      ? and(eq(clubSlotsTable.clubId, clubId), eq(clubSlotsTable.date, dateFilter))
      : eq(clubSlotsTable.clubId, clubId)
    : and(
        eq(clubSlotsTable.clubId, clubId),
        eq(clubSlotsTable.status, "open"),
        gte(clubSlotsTable.date, todayISO()),
      );

  const rows = await db
    .select()
    .from(clubSlotsTable)
    .where(where)
    .orderBy(asc(clubSlotsTable.date), asc(clubSlotsTable.startTime));

  const interests = await loadInterests(rows.map((r) => r.id));
  res.json(rows.map((r) => serializeSlot(r, interests.get(r.id) ?? [])));
});

// Admin: create a slot
router.post("/clubs/:id/slots", async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const clubId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(clubId)) {
    res.status(400).json({ error: "Invalid club id" });
    return;
  }
  const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.id, clubId));
  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  const b = req.body ?? {};
  if (!b.date || !b.startTime || !b.endTime) {
    res.status(400).json({ error: "date, startTime, endTime required" });
    return;
  }
  const payload = verifyToken(getTokenFromRequest(req) ?? "");
  const createdBy = payload?.userId;
  if (!createdBy) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Build the list of dates this request should produce. When repeatWeekly is
  // true and repeatUntil is a valid ISO date >= the start date, we generate
  // one slot per matching weekday up to (and including) the end date and link
  // them with a shared recurring_series_id.
  const startDate = String(b.date);
  const repeatWeekly = b.repeatWeekly === true || b.repeatWeekly === "true";
  const repeatUntilRaw = typeof b.repeatUntil === "string" ? b.repeatUntil : "";

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  const dates: string[] = [startDate];
  let recurringSeriesId: string | null = null;
  if (repeatWeekly) {
    if (!dateRe.test(repeatUntilRaw)) {
      res.status(400).json({ error: "repeatUntil must be YYYY-MM-DD" });
      return;
    }
    if (repeatUntilRaw < startDate) {
      res.status(400).json({ error: "repeatUntil must be on or after date" });
      return;
    }
    // Cap at ~6 months to avoid runaway inserts.
    const startMs = Date.parse(startDate + "T00:00:00Z");
    const endMs = Date.parse(repeatUntilRaw + "T00:00:00Z");
    const maxMs = startMs + 1000 * 60 * 60 * 24 * 7 * 27;
    if (endMs > maxMs) {
      res.status(400).json({ error: "repeatUntil is too far in the future" });
      return;
    }
    dates.length = 0;
    for (let ms = startMs; ms <= endMs; ms += 1000 * 60 * 60 * 24 * 7) {
      dates.push(new Date(ms).toISOString().slice(0, 10));
    }
    if (dates.length > 1) {
      recurringSeriesId = randomUUID();
    }
  }

  const rows = await db
    .insert(clubSlotsTable)
    .values(
      dates.map((d) => ({
        clubId,
        date: d,
        startTime: String(b.startTime),
        endTime: String(b.endTime),
        courtNumber: b.courtNumber ? String(b.courtNumber) : null,
        priceAed: b.priceAed != null && b.priceAed !== "" ? String(b.priceAed) : null,
        levelSuitability: b.levelSuitability ? String(b.levelSuitability) : null,
        notes: b.notes ? String(b.notes) : null,
        status: b.status ?? "open",
        recurringSeriesId,
        createdBy,
      })),
    )
    .returning();

  if (rows.length === 1) {
    res.status(201).json(serializeSlot(rows[0], []));
    return;
  }
  res.status(201).json({
    recurringSeriesId,
    count: rows.length,
    slots: rows.map((r) => serializeSlot(r, [])),
  });
});

// Admin: update a slot
router.patch("/slots/:slotId", async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const slotId = parseInt(String(req.params.slotId), 10);
  if (!Number.isFinite(slotId)) {
    res.status(400).json({ error: "Invalid slot id" });
    return;
  }
  const b = req.body ?? {};
  const updates: Partial<typeof clubSlotsTable.$inferInsert> = { updatedAt: new Date() };
  for (const k of ["date", "startTime", "endTime", "courtNumber", "levelSuitability", "notes", "status"] as const) {
    if (k in b) (updates as Record<string, unknown>)[k] = b[k] ?? null;
  }
  if ("priceAed" in b) updates.priceAed = b.priceAed != null && b.priceAed !== "" ? String(b.priceAed) : null;

  const [row] = await db
    .update(clubSlotsTable)
    .set(updates)
    .where(eq(clubSlotsTable.id, slotId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }
  const interests = await loadInterests([slotId]);
  res.json(serializeSlot(row, interests.get(slotId) ?? []));
});

// Admin: cancel/delete a slot. With ?scope=future, also cancels every later
// open slot in the same recurring series.
router.delete("/slots/:slotId", async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const slotId = parseInt(String(req.params.slotId), 10);
  if (!Number.isFinite(slotId)) {
    res.status(400).json({ error: "Invalid slot id" });
    return;
  }
  const scope = String(req.query.scope ?? "this") === "future" ? "future" : "this";

  const [row] = await db
    .update(clubSlotsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(clubSlotsTable.id, slotId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }

  let futureCancelled = 0;
  if (scope === "future" && row.recurringSeriesId) {
    const updated = await db
      .update(clubSlotsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(clubSlotsTable.recurringSeriesId, row.recurringSeriesId),
          gt(clubSlotsTable.date, row.date),
          eq(clubSlotsTable.status, "open"),
        ),
      )
      .returning({ id: clubSlotsTable.id });
    futureCancelled = updated.length;
  }

  res.json({ ok: true, scope, futureCancelled });
});

// Player: register interest in a slot
router.post("/slots/:slotId/interest", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const slotId = parseInt(String(req.params.slotId), 10);
  if (!Number.isFinite(slotId)) {
    res.status(400).json({ error: "Invalid slot id" });
    return;
  }
  const [slot] = await db.select().from(clubSlotsTable).where(eq(clubSlotsTable.id, slotId));
  if (!slot) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }
  if (slot.status !== "open") {
    res.status(409).json({ error: "Slot is not open" });
    return;
  }

  try {
    await db
      .insert(slotInterestsTable)
      .values({ slotId, userId: payload.userId })
      .onConflictDoNothing();
  } catch {
    /* ignore */
  }

  // Notify all coach/admin mode users
  const [player] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  const [club] = await db
    .select({ name: clubsTable.name })
    .from(clubsTable)
    .where(eq(clubsTable.id, slot.clubId));
  const recipients = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.modeCoach} = true OR ${usersTable.modeAdmin} = true`);

  const playerName = player?.name ?? "Player";
  const clubName = club?.name ?? "—";
  const when = `${slot.date} ${slot.startTime}`;
  for (const r of recipients) {
    void sendPushToUser(r.id, {
      title: {
        en: "Slot interest",
        ru: "Интерес к слоту",
        ar: "اهتمام بالموعد",
      },
      body: {
        en: `${playerName} is interested in a slot — ${clubName}, ${when}`,
        ru: `Игрок ${playerName} заинтересован в слоте — ${clubName}, ${when}`,
        ar: `${playerName} مهتم بالموعد — ${clubName}، ${when}`,
      },
      url: "/admin/slots",
      tag: `slot-interest-${slotId}-${payload.userId}`,
    });
  }

  const interests = await loadInterests([slotId]);
  res.status(201).json(serializeSlot(slot, interests.get(slotId) ?? []));
});

// Player: book a slot — creates a match + booking using the existing bookings pipeline,
// and marks the slot as taken.
router.post("/slots/:slotId/book", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const slotId = parseInt(String(req.params.slotId), 10);
  if (!Number.isFinite(slotId)) {
    res.status(400).json({ error: "Invalid slot id" });
    return;
  }

  // Pre-flight checks (user + club lookups) outside the transaction.
  const [existing] = await db.select().from(clubSlotsTable).where(eq(clubSlotsTable.id, slotId));
  if (!existing) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }
  if (existing.status !== "open") {
    res.status(409).json({ error: "Slot is not open" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role === "player" && (!user.level || user.level.trim() === "")) {
    res.status(400).json({
      error: "Please set your padel level before booking a court.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, existing.clubId));
  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  // Atomically claim the slot, then create match + booking in the same transaction.
  // If another request wins the race, the conditional UPDATE returns no rows and we 409.
  let booking: typeof bookingsTable.$inferSelect;
  let match: typeof matchesTable.$inferSelect;
  let slot: typeof clubSlotsTable.$inferSelect;
  try {
    const result = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(clubSlotsTable)
        .set({ status: "taken", updatedAt: new Date() })
        .where(and(eq(clubSlotsTable.id, slotId), eq(clubSlotsTable.status, "open")))
        .returning();
      if (!claimed) {
        throw new Error("SLOT_TAKEN");
      }

      const price = claimed.priceAed != null ? Number(claimed.priceAed) : 120;
      const players = [
        {
          userId: user.id,
          name: user.name,
          level: user.level,
          confirmed: true,
          avatar: user.avatar ?? null,
        },
      ];

      const [m] = await tx
        .insert(matchesTable)
        .values({
          date: claimed.date,
          time: claimed.startTime,
          clubName: club.name,
          format: "Simplified",
          players: JSON.stringify(players),
          status: "scheduled",
          price: Number.isFinite(price) ? price : 120,
          levelMin: user.level ?? null,
          levelMax: user.level ?? null,
          matchType: "balanced",
        })
        .returning();

      const [b] = await tx
        .insert(bookingsTable)
        .values({ userId: user.id, matchId: m.id })
        .returning();

      await tx.insert(activityLogsTable).values({
        userId: user.id,
        userName: user.name,
        action: "match_booked",
        details: `Booked slot at ${club.name} on ${claimed.date} ${claimed.startTime}`,
        detailsParams: { clubName: club.name, date: claimed.date, time: claimed.startTime },
      });

      return { booking: b, match: m, slot: claimed };
    });
    booking = result.booking;
    match = result.match;
    slot = result.slot;
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      res.status(409).json({ error: "Slot is not open" });
      return;
    }
    throw err;
  }

  // Notify coach/admin users
  const recipients = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.modeCoach} = true OR ${usersTable.modeAdmin} = true`);
  const when = `${slot.date} ${slot.startTime}`;
  for (const r of recipients) {
    void sendPushToUser(r.id, {
      title: {
        en: "Slot booked",
        ru: "Слот забронирован",
        ar: "تم حجز الموعد",
      },
      body: {
        en: `${user.name} booked ${club.name} — ${when}`,
        ru: `${user.name} забронировал ${club.name} — ${when}`,
        ar: `${user.name} حجز ${club.name} — ${when}`,
      },
      url: "/admin/slots",
      tag: `slot-booked-${slotId}`,
    });
  }

  res.status(201).json({
    booking: {
      id: booking.id,
      userId: booking.userId,
      matchId: booking.matchId,
      paymentStatus: booking.paymentStatus,
    },
    matchId: match.id,
    slot: serializeSlot({ ...slot, status: "taken" }, []),
  });
});

// Player: unregister interest
router.delete("/slots/:slotId/interest", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const slotId = parseInt(String(req.params.slotId), 10);
  if (!Number.isFinite(slotId)) {
    res.status(400).json({ error: "Invalid slot id" });
    return;
  }
  await db
    .delete(slotInterestsTable)
    .where(and(eq(slotInterestsTable.slotId, slotId), eq(slotInterestsTable.userId, payload.userId)));
  res.json({ ok: true });
});

export default router;
