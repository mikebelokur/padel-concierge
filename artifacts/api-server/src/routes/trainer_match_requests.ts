import { Router, type IRouter } from "express";
import { db, trainerMatchRequestsTable, matchFeedbackTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

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
  const playerId = req.query.playerId ? parseInt(req.query.playerId as string) : undefined;
  let rows = await db.select().from(trainerMatchRequestsTable)
    .orderBy(desc(trainerMatchRequestsTable.createdAt));
  if (playerId) rows = rows.filter(r => r.playerId === playerId);

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
  const { playerId, format, venue, requestedDate, requestedTime, notes } = req.body;
  if (!playerId || !requestedDate || !requestedTime) {
    res.status(400).json({ error: "playerId, requestedDate, requestedTime required" });
    return;
  }
  const [row] = await db.insert(trainerMatchRequestsTable).values({
    playerId: parseInt(playerId),
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
  res.status(201).json(row);
});

router.get("/match-feedback", async (req, res): Promise<void> => {
  const matchId = req.query.matchId ? parseInt(req.query.matchId as string) : undefined;
  if (!matchId) { res.status(400).json({ error: "matchId required" }); return; }
  const rows = await db.select().from(matchFeedbackTable).where(eq(matchFeedbackTable.matchId, matchId));
  res.json(rows);
});

export default router;
