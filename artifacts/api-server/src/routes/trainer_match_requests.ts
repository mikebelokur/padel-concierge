import { Router, type IRouter } from "express";
import { db, trainerMatchRequestsTable, matchFeedbackTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { upsertFeedbackAggregate } from "@workspace/db";
import { fireAndForget } from "../lib/fireAndForget.js";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

const LEVELS = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"];
const LEVEL_INDEX = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

function compatibilityScore(
  a: { level: string; archetype?: string | null },
  b: { level: string; archetype?: string | null }
): number {
  let score = 50;
  const levelDiff = Math.abs((LEVEL_INDEX[a.level] ?? 5) - (LEVEL_INDEX[b.level] ?? 5));
  if (levelDiff === 0) score += 25;
  else if (levelDiff === 1) score += 15;
  else if (levelDiff === 2) score += 0;
  else score -= 20;
  if (a.archetype && b.archetype && a.archetype === b.archetype) score += 25;
  else if (a.archetype && b.archetype) score += 5;
  return Math.min(99, Math.max(10, score));
}

// ─── TRAINER MATCH REQUESTS ──────────────────────────────────────────────────

router.get("/trainer-match-requests", async (req, res): Promise<void> => {
  const authRole: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  const isPrivileged = ["coach", "admin", "owner"].includes(authRole);

  const requestedPlayerId = req.query.playerId
    ? parseInt(req.query.playerId as string)
    : undefined;

  // Players may only see their own requests, regardless of query string.
  const effectivePlayerId = isPrivileged ? requestedPlayerId : authUserId;

  let rows = await db.select().from(trainerMatchRequestsTable)
    .orderBy(desc(trainerMatchRequestsTable.createdAt));
  if (effectivePlayerId) rows = rows.filter(r => r.playerId === effectivePlayerId);

  const playerIds = [...new Set(rows.map(r => r.playerId))];
  const players = playerIds.length
    ? await Promise.all(
        playerIds.map(pid =>
          db.select({ id: usersTable.id, name: usersTable.name, level: usersTable.level, archetype: usersTable.archetype })
            .from(usersTable).where(eq(usersTable.id, pid)).then(r => r[0])
        )
      )
    : [];
  const playerMap = Object.fromEntries(players.filter(Boolean).map(p => [p.id, p]));

  res.json(rows.map(r => ({ ...r, player: playerMap[r.playerId] ?? null })));
});

router.post("/trainer-match-requests", async (req, res): Promise<void> => {
  const authRole: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  const isPrivileged = ["coach", "admin", "owner"].includes(authRole);

  const { playerId: bodyPlayerId, format, venue, requestedDate, requestedTime, notes } = req.body;
  // Players cannot create requests on behalf of others — always force to self.
  // Privileged roles may specify a playerId; otherwise fall back to self.
  const playerId = isPrivileged
    ? (bodyPlayerId ?? authUserId)
    : authUserId;

  if (!requestedDate || !requestedTime) {
    res.status(400).json({ error: "requestedDate, requestedTime required" });
    return;
  }

  const [player] = await db.select({ level: usersTable.level }).from(usersTable).where(eq(usersTable.id, parseInt(String(playerId))));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  if (!player.level || player.level.trim() === "") {
    res.status(400).json({
      error: "Level not set. Please complete the level assessment first.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const [row] = await db.insert(trainerMatchRequestsTable).values({
    playerId: parseInt(String(playerId)),
    format: format ?? "4v4",
    venue: venue ?? "Padel Edition",
    requestedDate,
    requestedTime,
    notes: notes ?? "",
  }).returning();
  res.status(201).json(row);
});

router.patch("/trainer-match-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, assignedMatchId } = req.body;
  const [row] = await db.update(trainerMatchRequestsTable)
    .set({
      ...(status ? { status } : {}),
      ...(assignedMatchId ? { assignedMatchId: parseInt(assignedMatchId) } : {}),
    })
    .where(eq(trainerMatchRequestsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.get("/trainer-match-requests/candidates", async (req, res): Promise<void> => {
  const playerId = req.query.playerId ? parseInt(req.query.playerId as string) : undefined;
  const [player] = playerId
    ? await db.select().from(usersTable).where(eq(usersTable.id, playerId))
    : [null];

  const allUsers = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    level: usersTable.level,
    archetype: usersTable.archetype,
    verified: usersTable.verified,
    matchesPlayed: usersTable.matchesPlayed,
  }).from(usersTable);

  const others = allUsers.filter(u => u.id !== playerId);
  const withCompat = others.map(u => ({
    ...u,
    compatibility: player ? compatibilityScore(player, u) : 50,
  })).sort((a, b) => b.compatibility - a.compatibility);

  res.json(withCompat);
});

// ─── MATCH FEEDBACK ───────────────────────────────────────────────────────────

router.post("/match-feedback", async (req, res): Promise<void> => {
  const { matchId, aboutUserId, rating, traits, comment } = req.body;
  if (!matchId || !aboutUserId) {
    res.status(400).json({ error: "matchId and aboutUserId required" });
    return;
  }
  const [row] = await db.insert(matchFeedbackTable).values({
    matchId: parseInt(matchId),
    aboutUserId: parseInt(aboutUserId),
    rating: rating ?? 5,
    traits: traits ?? [],
    comment: comment ?? "",
  }).returning();

  fireAndForget(
    upsertFeedbackAggregate({
      aboutUserId: parseInt(aboutUserId),
      fromUserId: req.body.fromUserId ? parseInt(req.body.fromUserId) : 0,
      rating: rating ?? 5,
      traits: traits ?? [],
    }),
    { route: "POST /match-feedback", matchId, aboutUserId }
  );

  res.status(201).json(row);
});

router.get("/match-feedback", async (req, res): Promise<void> => {
  const matchId = req.query.matchId ? parseInt(req.query.matchId as string) : undefined;
  if (!matchId) { res.status(400).json({ error: "matchId required" }); return; }
  const rows = await db.select().from(matchFeedbackTable).where(eq(matchFeedbackTable.matchId, matchId));
  res.json(rows);
});

export default router;
