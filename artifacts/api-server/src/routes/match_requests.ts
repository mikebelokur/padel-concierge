import { Router, type IRouter } from "express";
import { db, matchRequestsTable, usersTable, activityLogsTable, matchesTable } from "@workspace/db";
import { and, eq, gt, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

async function formatRequest(r: typeof matchRequestsTable.$inferSelect) {
  const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, r.fromUserId));
  const [toUser] = await db.select().from(usersTable).where(eq(usersTable.id, r.toUserId));
  return {
    id: r.id,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    message: r.message ?? null,
    status: r.status,
    proposedDate: r.proposedDate ?? null,
    proposedTime: r.proposedTime ?? null,
    matchId: r.matchId ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    fromUser: fromUser ? { id: fromUser.id, name: fromUser.name, level: fromUser.level, avatar: fromUser.avatar ?? null, verified: fromUser.verified } : null,
    toUser: toUser ? { id: toUser.id, name: toUser.name, level: toUser.level, avatar: toUser.avatar ?? null, verified: toUser.verified } : null,
  };
}

router.get("/match-requests/pending-count", async (req, res): Promise<void> => {
  const authUserId: number = (req as any).auth.userId;
  const since = req.query.since ? new Date(String(req.query.since)) : null;

  const conditions = [
    eq(matchRequestsTable.toUserId, authUserId),
    eq(matchRequestsTable.status, "pending"),
    ...(since ? [gt(matchRequestsTable.createdAt, since)] : []),
  ];

  const requests = await db.select({ id: matchRequestsTable.id })
    .from(matchRequestsTable)
    .where(and(...conditions));

  res.json({ count: requests.length });
});

router.get("/match-requests", async (req, res): Promise<void> => {
  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : null;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  const requests = await db.select().from(matchRequestsTable)
    .where(or(eq(matchRequestsTable.fromUserId, userId), eq(matchRequestsTable.toUserId, userId)));

  const formatted = await Promise.all(requests.map(formatRequest));
  formatted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(formatted);
});

router.post("/match-requests", async (req, res): Promise<void> => {
  const authUserId: number = (req as any).auth.userId;
  const { toUserId, message, proposedDate, proposedTime } = req.body;
  if (!toUserId) {
    res.status(400).json({ error: "toUserId required" });
    return;
  }

  const [from] = await db.select().from(usersTable).where(eq(usersTable.id, authUserId));
  const [to] = await db.select().from(usersTable).where(eq(usersTable.id, Number(toUserId)));
  if (!from || !to) { res.status(404).json({ error: "User not found" }); return; }

  if (!from.level || from.level.trim() === "") {
    res.status(400).json({
      error: "Level not set. Please complete the level assessment first.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const [request] = await db.insert(matchRequestsTable).values({
    fromUserId: authUserId,
    toUserId: Number(toUserId),
    message: message ?? null,
    proposedDate: proposedDate ?? null,
    proposedTime: proposedTime ?? null,
    status: "pending",
  }).returning();

  await db.insert(activityLogsTable).values([
    {
      userId: from.id,
      userName: from.name,
      action: "match_request_sent",
      details: `Sent match request to ${to.name}`,
    },
    {
      userId: to.id,
      userName: to.name,
      action: "match_request_received",
      details: `Received match request from ${from.name}`,
    },
  ]);

  res.status(201).json(await formatRequest(request));
});

router.patch("/match-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { status } = req.body;
  if (!status || !["accepted", "declined", "cancelled"].includes(status)) {
    res.status(400).json({ error: "status must be accepted, declined, or cancelled" });
    return;
  }

  const authUserId: number = (req as any).auth.userId;

  const [existing] = await db.select().from(matchRequestsTable).where(eq(matchRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Request not found" }); return; }

  const isRecipient = existing.toUserId === authUserId;
  const isSender = existing.fromUserId === authUserId;

  if ((status === "accepted" || status === "declined") && !isRecipient) {
    res.status(403).json({ error: "Only the recipient can accept or decline a request" });
    return;
  }
  if (status === "cancelled" && !isSender) {
    res.status(403).json({ error: "Only the sender can cancel a request" });
    return;
  }

  if (existing.status === "accepted" && status === "accepted") {
    res.json(await formatRequest(existing));
    return;
  }

  const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, existing.fromUserId));
  const [toUser] = await db.select().from(usersTable).where(eq(usersTable.id, existing.toUserId));

  let createdMatchId: number | null = null;

  if (status === "accepted" && existing.proposedDate && fromUser && toUser && !existing.matchId) {
    const LEVELS = ["D-", "D", "D+", "C-", "C", "C+"];
    const LEVEL_INDEX = Object.fromEntries(LEVELS.map((l, i) => [l, i]));
    const levels = [fromUser, toUser].map(p => LEVEL_INDEX[p.level] ?? 0);
    const levelMin = LEVELS[Math.min(...levels)] ?? null;
    const levelMax = LEVELS[Math.max(...levels)] ?? null;
    const players = [fromUser, toUser].map(p => ({
      userId: p.id,
      name: p.name,
      level: p.level,
      confirmed: false,
      avatar: p.avatar ?? null,
    }));

    const [match] = await db.insert(matchesTable).values({
      date: existing.proposedDate,
      time: existing.proposedTime ?? "TBD",
      clubName: "TBD",
      format: "2v2",
      players: JSON.stringify(players),
      matchType: "balanced",
      levelMin,
      levelMax,
      balanceScore: 100 - (Math.max(...levels) - Math.min(...levels)) * 20,
      status: "scheduled",
    }).returning();

    createdMatchId = match.id;

    await db.insert(activityLogsTable).values({
      userId: fromUser.id,
      userName: fromUser.name,
      action: "match_created",
      details: `Match scheduled with ${toUser.name} on ${existing.proposedDate}`,
    });
  }

  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (createdMatchId !== null) updateData.matchId = createdMatchId;

  const [request] = await db.update(matchRequestsTable).set(updateData).where(eq(matchRequestsTable.id, id)).returning();

  if (toUser && fromUser) {
    await db.insert(activityLogsTable).values({
      userId: toUser.id,
      userName: toUser.name,
      action: `match_request_${status}`,
      details: `${status === "accepted" ? "Accepted" : "Declined"} match request from ${fromUser.name}`,
    });
  }

  res.json(await formatRequest(request));
});

export default router;
