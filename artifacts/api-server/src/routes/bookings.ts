import { Router, type IRouter } from "express";
import { db, bookingsTable, matchesTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateBookingBody, UpdateBookingBody, ListBookingsQueryParams, ConfirmPaymentBody } from "@workspace/api-zod";
import { formatMatch } from "./matches";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { sendPushToUser } from "../lib/push";

const router: IRouter = Router();
router.use(requireAuth);

async function formatBooking(b: typeof bookingsTable.$inferSelect) {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, b.matchId));
  return {
    id: b.id,
    userId: b.userId,
    matchId: b.matchId,
    paymentStatus: b.paymentStatus,
    paymentId: b.paymentId ?? null,
    warmUpCompleted: b.warmUpCompleted,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    match: match ? formatMatch(match) : null,
  };
}

router.get("/bookings", async (req, res): Promise<void> => {
  const params = ListBookingsQueryParams.safeParse(req.query);
  let bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.createdAt);

  if (params.success) {
    if (params.data.userId) {
      bookings = bookings.filter(b => b.userId === params.data.userId);
    }
    if (params.data.matchId) {
      bookings = bookings.filter(b => b.matchId === params.data.matchId);
    }
  }

  const formatted = await Promise.all(bookings.map(formatBooking));
  res.json(formatted);
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { userId, matchId } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  // Task #137: block bookings when player has no level set
  if (user.role === "player" && (!user.level || user.level.trim() === "")) {
    res.status(400).json({
      error: "Please set your padel level before booking a court.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const [booking] = await db.insert(bookingsTable).values({ userId, matchId }).returning();

  await db.insert(activityLogsTable).values({
    userId,
    userName: user.name,
    action: "match_booked",
    details: `Booked match at ${match.clubName} on ${match.date}`,
  });

  res.status(201).json(await formatBooking(booking));
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  res.json(await formatBooking(booking));
});

router.patch("/bookings/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateBookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [booking] = await db.update(bookingsTable).set({
    ...(parsed.data.warmUpCompleted !== undefined && { warmUpCompleted: parsed.data.warmUpCompleted }),
    ...(parsed.data.paymentStatus && { paymentStatus: parsed.data.paymentStatus }),
    ...(parsed.data.cancelledAt !== undefined && {
      cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
    }),
  }).where(eq(bookingsTable.id, id)).returning();

  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  if (parsed.data.warmUpCompleted) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, booking.userId));
    if (user) {
      await db.insert(activityLogsTable).values({
        userId: booking.userId,
        userName: user.name,
        action: "warmup_completed",
        details: `Warm-up completed for match #${booking.matchId}`,
      });
    }
  }

  if (parsed.data.cancelledAt) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, booking.userId));
    if (user) {
      await db.insert(activityLogsTable).values({
        userId: booking.userId,
        userName: user.name,
        action: "booking_cancelled",
        details: `Cancelled booking #${booking.id}`,
      });
      const [m] = await db.select().from(matchesTable).where(eq(matchesTable.id, booking.matchId));
      void sendPushToUser(booking.userId, {
        title: {
          en: "Booking cancelled",
          ru: "Бронирование отменено",
          ar: "تم إلغاء الحجز",
        },
        body: m
          ? {
              en: `Your booking at ${m.clubName} on ${m.date} was cancelled`,
              ru: `Ваше бронирование в ${m.clubName} на ${m.date} отменено`,
              ar: `تم إلغاء حجزك في ${m.clubName} بتاريخ ${m.date}`,
            }
          : {
              en: "Your booking was cancelled",
              ru: "Ваше бронирование отменено",
              ar: "تم إلغاء حجزك",
            },
        url: "/bookings",
        tag: `booking-${booking.id}-cancelled`,
      });
    }
  }

  res.json(await formatBooking(booking));
});

router.post("/bookings/lateness-split", async (req, res): Promise<void> => {
  const { courtCost = 400, numPlayers = 4, latePlayers = [] } = req.body as {
    courtCost?: number;
    numPlayers?: number;
    latePlayers?: Array<{ playerIndex: number; name?: string; minutesLate: number }>;
  };

  if (numPlayers < 2 || numPlayers > 8) {
    res.status(400).json({ error: "numPlayers must be 2–8" });
    return;
  }

  const baseShare = courtCost / numPlayers;
  const lateSet = new Set(latePlayers.map(lp => lp.playerIndex));

  const splits = Array.from({ length: numPlayers }, (_, i) => {
    const entry = latePlayers.find(lp => lp.playerIndex === i);
    if (entry) {
      const penalty = entry.minutesLate * (courtCost / 100);
      return {
        playerIndex: i,
        name: entry.name ?? `Player ${i + 1}`,
        baseShare: Math.round(baseShare * 100) / 100,
        penalty: Math.round(penalty * 100) / 100,
        total: Math.round((baseShare + penalty) * 100) / 100,
        isLate: true,
        minutesLate: entry.minutesLate,
      };
    }
    const numLate = latePlayers.length;
    const totalPenalty = latePlayers.reduce((s, lp) => s + lp.minutesLate * (courtCost / 100), 0);
    const saving = numLate > 0 ? totalPenalty / (numPlayers - numLate) : 0;
    return {
      playerIndex: i,
      name: `Player ${i + 1}`,
      baseShare: Math.round(baseShare * 100) / 100,
      penalty: 0,
      saving: Math.round(saving * 100) / 100,
      total: Math.round((baseShare - saving) * 100) / 100,
      isLate: false,
      minutesLate: 0,
    };
  });

  const totalCollected = splits.reduce((s, sp) => s + sp.total, 0);

  res.json({
    courtCost,
    numPlayers,
    baseShare: Math.round(baseShare * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    penaltyRateInfo: "1% of court cost per minute late",
    splits,
  });
});

router.post("/bookings/:id/payment", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const paymentIntentId = `pi_test_${Date.now()}_${booking.id}`;
  const clientSecret = `${paymentIntentId}_secret_test`;

  res.json({ clientSecret, paymentIntentId });
});

router.post("/bookings/:id/confirm-payment", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = ConfirmPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [booking] = await db.update(bookingsTable).set({
    paymentStatus: "completed",
    paymentId: parsed.data.paymentIntentId,
  }).where(eq(bookingsTable.id, id)).returning();

  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, booking.userId));
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, booking.matchId));

  if (user && match) {
    await db.insert(activityLogsTable).values({
      userId: booking.userId,
      userName: user.name,
      action: "payment_completed",
      details: `Paid 120 AED for match at ${match.clubName}`,
    });
    void sendPushToUser(booking.userId, {
      title: {
        en: "Booking confirmed",
        ru: "Бронирование подтверждено",
        ar: "تم تأكيد الحجز",
      },
      body: `${match.clubName} · ${match.date} ${match.time}`,
      url: "/bookings",
      tag: `booking-${booking.id}-confirmed`,
    });
  }

  res.json(await formatBooking(booking));
});

export default router;
