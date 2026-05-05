import { Router, type IRouter } from "express";
import { db, coachingClientsTable, coachingSessionsTable, postMatchNotesTable, coachingMessagesTable, recurringSchedulesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

// ─── CLIENTS ────────────────────────────────────────────────────────────────

router.get("/coaching/clients", async (_req, res): Promise<void> => {
  const clients = await db.select().from(coachingClientsTable).orderBy(coachingClientsTable.name);
  res.json(clients);
});

router.get("/coaching/clients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [client] = await db.select().from(coachingClientsTable).where(eq(coachingClientsTable.id, id));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const sessions = await db.select().from(coachingSessionsTable)
    .where(eq(coachingSessionsTable.clientId, id))
    .orderBy(coachingSessionsTable.sessionNumber);

  const notes = await db.select().from(postMatchNotesTable)
    .where(eq(postMatchNotesTable.clientId, id))
    .orderBy(desc(postMatchNotesTable.recordedAt));

  const messages = await db.select().from(coachingMessagesTable)
    .where(eq(coachingMessagesTable.clientId, id))
    .orderBy(coachingMessagesTable.sentAt);

  const recurring = await db.select().from(recurringSchedulesTable)
    .where(and(eq(recurringSchedulesTable.clientId, id), eq(recurringSchedulesTable.active, true)));

  res.json({ client, sessions, notes, messages, recurring });
});

router.post("/coaching/clients", async (req, res): Promise<void> => {
  const { name, phone, email, level, bookingPattern, pricePerSession, notes, tags } = req.body;
  const [client] = await db.insert(coachingClientsTable).values({
    name, phone: phone ?? "", email: email ?? "", level: level ?? "C",
    bookingPattern: bookingPattern ?? "on_demand",
    pricePerSession: pricePerSession ?? 700,
    notes: notes ?? "", avatarInitials: name?.[0]?.toUpperCase() ?? "?",
    tags: tags ?? [],
  }).returning();
  res.status(201).json(client);
});

router.put("/coaching/clients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, phone, email, level, notes, nextSessionPlan, status, pricePerSession } = req.body;
  const [updated] = await db.update(coachingClientsTable)
    .set({ name, phone, email, level, notes, nextSessionPlan, status, pricePerSession })
    .where(eq(coachingClientsTable.id, id))
    .returning();
  res.json(updated);
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────

router.get("/coaching/sessions", async (req, res): Promise<void> => {
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
  const sessions = clientId
    ? await db.select().from(coachingSessionsTable).where(eq(coachingSessionsTable.clientId, clientId)).orderBy(coachingSessionsTable.sessionNumber)
    : await db.select().from(coachingSessionsTable).orderBy(desc(coachingSessionsTable.date));
  res.json(sessions);
});

router.post("/coaching/sessions", async (req, res): Promise<void> => {
  const { clientId, sessionNumber, topic, subtopics, date, time, durationMinutes, court, coachNotes, drillsCovered, nextSessionFocus } = req.body;
  const [session] = await db.insert(coachingSessionsTable).values({
    clientId, sessionNumber, topic, subtopics: subtopics ?? [],
    date, time: time ?? "09:30", durationMinutes: durationMinutes ?? 60,
    court: court ?? "", status: "completed",
    coachNotes: coachNotes ?? "", drillsCovered: drillsCovered ?? [],
    nextSessionFocus: nextSessionFocus ?? "",
  }).returning();

  await db.update(coachingClientsTable)
    .set({ totalSessions: sessionNumber, lastSessionDate: new Date(date) })
    .where(eq(coachingClientsTable.id, clientId));

  res.status(201).json(session);
});

router.put("/coaching/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { topic, subtopics, coachNotes, drillsCovered, nextSessionFocus, status } = req.body;
  const [updated] = await db.update(coachingSessionsTable)
    .set({ topic, subtopics, coachNotes, drillsCovered, nextSessionFocus, status })
    .where(eq(coachingSessionsTable.id, id))
    .returning();
  res.json(updated);
});

// ─── POST-MATCH NOTES ────────────────────────────────────────────────────────

router.post("/coaching/notes", async (req, res): Promise<void> => {
  const { clientId, sessionId, question, coachResponse, category } = req.body;
  const [note] = await db.insert(postMatchNotesTable).values({
    clientId, sessionId: sessionId ?? null,
    question, coachResponse: coachResponse ?? "",
    category: category ?? "technique",
  }).returning();
  res.status(201).json(note);
});

router.put("/coaching/notes/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { coachResponse } = req.body;
  const [updated] = await db.update(postMatchNotesTable)
    .set({ coachResponse })
    .where(eq(postMatchNotesTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/coaching/notes/:id", async (req, res): Promise<void> => {
  await db.delete(postMatchNotesTable).where(eq(postMatchNotesTable.id, parseInt(req.params.id)));
  res.json({ message: "Deleted" });
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────

router.get("/coaching/messages", async (req, res): Promise<void> => {
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
  const messages = clientId
    ? await db.select().from(coachingMessagesTable)
        .where(eq(coachingMessagesTable.clientId, clientId))
        .orderBy(coachingMessagesTable.sentAt)
    : await db.select().from(coachingMessagesTable).orderBy(desc(coachingMessagesTable.sentAt));
  res.json(messages);
});

router.post("/coaching/messages", async (req, res): Promise<void> => {
  const { clientId, content, direction, channel } = req.body;
  const [msg] = await db.insert(coachingMessagesTable).values({
    clientId, content, direction: direction ?? "out",
    channel: channel ?? "whatsapp", read: true,
  }).returning();
  res.status(201).json(msg);
});

router.put("/coaching/messages/read/:clientId", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId);
  await db.update(coachingMessagesTable)
    .set({ read: true })
    .where(and(eq(coachingMessagesTable.clientId, clientId), eq(coachingMessagesTable.direction, "in")));
  res.json({ message: "Marked as read" });
});

// ─── RECURRING SCHEDULES ─────────────────────────────────────────────────────

router.get("/coaching/recurring", async (_req, res): Promise<void> => {
  const schedules = await db.select().from(recurringSchedulesTable)
    .where(eq(recurringSchedulesTable.active, true));
  res.json(schedules);
});

router.post("/coaching/recurring", async (req, res): Promise<void> => {
  const { clientId, dayOfWeek, startTime, endTime, court } = req.body;
  const [s] = await db.insert(recurringSchedulesTable).values({
    clientId, dayOfWeek, startTime, endTime, court: court ?? "", active: true,
  }).returning();
  res.status(201).json(s);
});

// ─── TODAY'S SESSIONS ─────────────────────────────────────────────────────────

router.get("/coaching/today", async (_req, res): Promise<void> => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const today = now.toISOString().split("T")[0];

  const recurring = await db.select().from(recurringSchedulesTable)
    .where(and(eq(recurringSchedulesTable.dayOfWeek, dayOfWeek), eq(recurringSchedulesTable.active, true)));

  const clients = await db.select().from(coachingClientsTable);
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const sessions = recurring.map(s => ({
    ...s,
    client: clientMap[s.clientId] ?? null,
    type: "recurring",
    date: today,
  }));

  res.json(sessions);
});

export default router;
