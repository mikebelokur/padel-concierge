import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  coachingClientsTable,
  coachingSessionsTable,
  trainingBookingsTable,
  groupTrainingsTable,
  postMatchNotesTable,
  coachingMessagesTable,
  skillAssessmentsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireMode } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireMode("coach", "admin", "developer"));

type TimelineItem = {
  id: string;
  type: "session" | "training" | "post_match_note" | "message" | "assessment" | "notification";
  at: string;
  title: string;
  detail?: string;
};

router.get("/admin/users/:userId/profile", async (req, res): Promise<void> => {
  const me = (req as any).auth;
  if (!me || !["admin", "owner", "coach"].includes(me.role ?? "")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Coaches may only access linked coaching clients; admin/owner have full access.
  if (me.role === "coach" && !user.coachingClientId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const ccId = user.coachingClientId ?? null;
  const [client] = ccId
    ? await db.select().from(coachingClientsTable).where(eq(coachingClientsTable.id, ccId))
    : [];

  const sessions = ccId
    ? await db.select().from(coachingSessionsTable).where(eq(coachingSessionsTable.clientId, ccId)).orderBy(desc(coachingSessionsTable.date))
    : [];

  const bookingRows = await db
    .select({
      bookingId: trainingBookingsTable.id,
      status: trainingBookingsTable.status,
      bookedAt: trainingBookingsTable.bookedAt,
      trainingId: groupTrainingsTable.id,
      dateTime: groupTrainingsTable.dateTime,
      category: groupTrainingsTable.category,
      courtName: groupTrainingsTable.courtName,
      priceAed: groupTrainingsTable.priceAed,
    })
    .from(trainingBookingsTable)
    .leftJoin(groupTrainingsTable, eq(trainingBookingsTable.trainingId, groupTrainingsTable.id))
    .where(eq(trainingBookingsTable.userId, userId))
    .orderBy(desc(trainingBookingsTable.bookedAt));

  const notes = ccId
    ? await db.select().from(postMatchNotesTable).where(eq(postMatchNotesTable.clientId, ccId)).orderBy(desc(postMatchNotesTable.recordedAt))
    : [];

  const messages = ccId
    ? await db.select().from(coachingMessagesTable).where(eq(coachingMessagesTable.clientId, ccId)).orderBy(desc(coachingMessagesTable.sentAt))
    : [];

  const assessments = await db.select().from(skillAssessmentsTable).where(eq(skillAssessmentsTable.userId, userId)).orderBy(desc(skillAssessmentsTable.submittedAt));

  const notifs = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, userId)).orderBy(desc(notificationsTable.createdAt)).limit(50);

  // Stats
  const attendedBookings = bookingRows.filter(b => b.status === "attended" || b.status === "booked");
  const sessionRevenue = sessions.reduce((sum) => sum + (client?.pricePerSession ?? 0), 0);
  const trainingRevenue = attendedBookings.reduce((sum, b) => sum + (b.priceAed ? Number(b.priceAed) : 0), 0);

  // Timeline merge
  const timeline: TimelineItem[] = [];
  for (const s of sessions) {
    timeline.push({
      id: `session-${s.id}`,
      type: "session",
      at: new Date(s.date).toISOString(),
      title: s.topic,
      detail: s.coachNotes || s.subtopics.join(", "),
    });
  }
  for (const b of bookingRows) {
    if (!b.dateTime) continue;
    timeline.push({
      id: `training-${b.bookingId}`,
      type: "training",
      at: b.dateTime.toISOString(),
      title: `Group training ${b.category} — ${b.courtName ?? ""}`.trim(),
      detail: `Status: ${b.status}`,
    });
  }
  for (const n of notes) {
    timeline.push({
      id: `note-${n.id}`,
      type: "post_match_note",
      at: n.recordedAt.toISOString(),
      title: n.question,
      detail: n.coachResponse,
    });
  }
  for (const m of messages.slice(0, 20)) {
    timeline.push({
      id: `msg-${m.id}`,
      type: "message",
      at: m.sentAt.toISOString(),
      title: `${m.direction === "in" ? "← " : "→ "}${m.content.slice(0, 80)}`,
      detail: m.channel,
    });
  }
  for (const a of assessments) {
    timeline.push({
      id: `assess-${a.id}`,
      type: "assessment",
      at: a.submittedAt.toISOString(),
      title: `Level assessed: ${a.computedLevel}`,
      detail: a.notes ?? undefined,
    });
  }
  for (const n of notifs) {
    timeline.push({
      id: `notif-${n.id}`,
      type: "notification",
      at: n.createdAt.toISOString(),
      title: n.titleEn,
      detail: n.bodyEn,
    });
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  // Skills history
  const skillsHistory = assessments
    .slice()
    .reverse()
    .map(a => ({ at: a.submittedAt.toISOString(), level: a.computedLevel }));

  res.json({
    hero: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar ?? null,
      memberNumber: user.memberNumber,
      badge: user.badge ?? null,
      level: user.level,
      archetype: user.archetype ?? null,
      source: user.source ?? "self_signup",
      isOnline: user.isOnline,
      lastActive: user.lastActive?.toISOString() ?? null,
      role: user.role,
      inviteStatus: user.inviteStatus ?? "not_invited",
      coachingClientId: user.coachingClientId ?? null,
    },
    stats: {
      totalSessions: sessions.length,
      trainingsAttended: attendedBookings.length,
      revenueAed: Math.round(sessionRevenue + trainingRevenue),
      lastSeen: user.lastActive?.toISOString() ?? null,
    },
    timeline: timeline.slice(0, 100),
    skills: {
      history: skillsHistory,
      currentArchetype: user.archetype ?? null,
    },
    package: client
      ? {
          type: client.packageType,
          total: client.sessionsInPackage,
          used: client.sessionsUsed,
        }
      : null,
    notes: {
      text: client?.notes ?? "",
      tags: client?.tags ?? [],
    },
  });
});

router.patch("/admin/users/:userId/notes", async (req, res): Promise<void> => {
  const me = (req as any).auth;
  if (!me || !["admin", "owner"].includes(me.role ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const userId = parseInt(req.params.userId, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.coachingClientId) {
    res.status(404).json({ error: "No coaching client linked" }); return;
  }
  const notes = typeof req.body.notes === "string" ? req.body.notes : "";
  await db.update(coachingClientsTable).set({ notes }).where(eq(coachingClientsTable.id, user.coachingClientId));
  res.json({ ok: true });
});

export default router;
