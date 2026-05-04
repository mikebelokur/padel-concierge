import { Router, type IRouter } from "express";
import { db, matchRequestsTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const router: IRouter = Router();

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
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    fromUser: fromUser ? { id: fromUser.id, name: fromUser.name, level: fromUser.level, avatar: fromUser.avatar ?? null, verified: fromUser.verified } : null,
    toUser: toUser ? { id: toUser.id, name: toUser.name, level: toUser.level, avatar: toUser.avatar ?? null, verified: toUser.verified } : null,
  };
}

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
  const { fromUserId, toUserId, message, proposedDate, proposedTime } = req.body;
  if (!fromUserId || !toUserId) {
    res.status(400).json({ error: "fromUserId and toUserId required" });
    return;
  }

  const [from] = await db.select().from(usersTable).where(eq(usersTable.id, Number(fromUserId)));
  const [to] = await db.select().from(usersTable).where(eq(usersTable.id, Number(toUserId)));
  if (!from || !to) { res.status(404).json({ error: "User not found" }); return; }

  const [request] = await db.insert(matchRequestsTable).values({
    fromUserId: Number(fromUserId),
    toUserId: Number(toUserId),
    message: message ?? null,
    proposedDate: proposedDate ?? null,
    proposedTime: proposedTime ?? null,
    status: "pending",
  }).returning();

  await db.insert(activityLogsTable).values({
    userId: from.id,
    userName: from.name,
    action: "match_request_sent",
    details: `Sent match request to ${to.name}`,
  });

  res.status(201).json(await formatRequest(request));
});

router.patch("/match-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { status } = req.body;
  if (!status || !["accepted", "declined", "cancelled"].includes(status)) {
    res.status(400).json({ error: "status must be accepted, declined, or cancelled" });
    return;
  }

  const [request] = await db.update(matchRequestsTable).set({
    status,
    updatedAt: new Date(),
  }).where(eq(matchRequestsTable.id, id)).returning();

  if (!request) { res.status(404).json({ error: "Request not found" }); return; }

  const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, request.fromUserId));
  const [toUser] = await db.select().from(usersTable).where(eq(usersTable.id, request.toUserId));

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
