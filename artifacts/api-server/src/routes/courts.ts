import { Router, type IRouter } from "express";
import { db, courtsTable, courtBookingsTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getTokenFromRequest, verifyToken } from "../lib/auth";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

function parseCourt(c: typeof courtsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    location: c.location,
    address: c.address,
    pricePerHour: c.pricePerHour,
    amenities: JSON.parse(c.amenities ?? "[]"),
    surface: c.surface,
    indoor: c.indoor,
    imageUrl: c.imageUrl ?? null,
    availableSlots: JSON.parse(c.availableSlots ?? "[]"),
    createdAt: c.createdAt.toISOString(),
  };
}

function parseCourtBooking(b: typeof courtBookingsTable.$inferSelect, court?: typeof courtsTable.$inferSelect | null) {
  return {
    id: b.id,
    userId: b.userId,
    courtId: b.courtId,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    totalPrice: b.totalPrice,
    createdAt: b.createdAt.toISOString(),
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    court: court ? parseCourt(court) : null,
  };
}

router.get("/courts", async (_req, res): Promise<void> => {
  const courts = await db.select().from(courtsTable).orderBy(courtsTable.name);
  res.json(courts.map(parseCourt));
});

router.post("/courts", async (req, res): Promise<void> => {
  const { name, location, address, pricePerHour, amenities, surface, indoor, imageUrl, availableSlots } = req.body;
  if (!name || !location || !address) {
    res.status(400).json({ error: "name, location, address required" });
    return;
  }
  const [court] = await db.insert(courtsTable).values({
    name,
    location,
    address,
    pricePerHour: pricePerHour ?? 120,
    amenities: JSON.stringify(amenities ?? []),
    surface: surface ?? "clay",
    indoor: indoor ?? false,
    imageUrl: imageUrl ?? null,
    availableSlots: JSON.stringify(availableSlots ?? ["08:00","09:30","11:00","14:00","15:30","17:00","19:00"]),
  }).returning();
  res.status(201).json(parseCourt(court));
});

router.get("/courts/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, id));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }
  res.json(parseCourt(court));
});

router.get("/courts/:id/availability", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const date = String(req.query.date ?? "");
  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, id));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const bookedSlots = await db.select().from(courtBookingsTable)
    .where(and(eq(courtBookingsTable.courtId, id), eq(courtBookingsTable.date, date)));

  const bookedTimes = new Set(bookedSlots.filter(b => b.status !== "cancelled").map(b => b.startTime));
  const allSlots = JSON.parse(court.availableSlots ?? "[]") as string[];

  res.json(allSlots.map(slot => ({ time: slot, available: !bookedTimes.has(slot) })));
});

router.get("/court-bookings", async (req, res): Promise<void> => {
  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : null;
  let bookings = await db.select().from(courtBookingsTable).orderBy(courtBookingsTable.date);
  if (userId) bookings = bookings.filter(b => b.userId === userId);

  const result = await Promise.all(bookings.map(async (b) => {
    const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, b.courtId));
    return parseCourtBooking(b, court);
  }));
  res.json(result);
});

router.post("/court-bookings", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { userId: bodyUserId, courtId, date, startTime } = req.body;
  if (!courtId || !date || !startTime) {
    res.status(400).json({ error: "courtId, date, startTime required" });
    return;
  }

  // Security: only admin/coach may book on behalf of another user; players are
  // always bound to their own auth identity regardless of body payload.
  const requestedUserId = bodyUserId ? Number(bodyUserId) : payload.userId;
  const isPrivileged = payload.role === "admin" || payload.role === "coach";
  if (!isPrivileged && requestedUserId !== payload.userId) {
    res.status(403).json({ error: "Cannot book on behalf of another user" });
    return;
  }
  const userId = requestedUserId;

  // Task #137: gate court bookings behind a set player level
  const [bookingUser] = await db
    .select({ level: usersTable.level })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!bookingUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!bookingUser.level || bookingUser.level.trim() === "") {
    res.status(400).json({
      error: "Please set your padel level before booking a court.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, Number(courtId)));
  if (!court) { res.status(404).json({ error: "Court not found" }); return; }

  const existing = await db.select().from(courtBookingsTable)
    .where(and(eq(courtBookingsTable.courtId, Number(courtId)), eq(courtBookingsTable.date, date), eq(courtBookingsTable.startTime, startTime)));

  if (existing.some(b => b.status !== "cancelled")) {
    res.status(409).json({ error: "This slot is already booked" });
    return;
  }

  const slots = JSON.parse(court.availableSlots ?? "[]") as string[];
  const slotIdx = slots.indexOf(startTime);
  const endTime = slotIdx >= 0 && slotIdx + 1 < slots.length ? slots[slotIdx + 1] : startTime;

  const [booking] = await db.insert(courtBookingsTable).values({
    userId: Number(userId),
    courtId: Number(courtId),
    date,
    startTime,
    endTime,
    totalPrice: court.pricePerHour,
  }).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
  if (user) {
    await db.insert(activityLogsTable).values({
      userId: user.id,
      userName: user.name,
      action: "court_booked",
      details: `Booked ${court.name} on ${date} at ${startTime}`,
      detailsParams: { courtName: court.name, date, startTime },
    });
  }

  res.status(201).json(parseCourtBooking(booking, court));
});

router.patch("/court-bookings/:id/cancel", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [booking] = await db.update(courtBookingsTable).set({
    status: "cancelled",
    cancelledAt: new Date(),
  }).where(eq(courtBookingsTable.id, id)).returning();

  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const [court] = await db.select().from(courtsTable).where(eq(courtsTable.id, booking.courtId));
  res.json(parseCourtBooking(booking, court));
});

export default router;
