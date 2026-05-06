import { Router, type IRouter } from "express";
import { db, matchesTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateMatchBody, UpdateMatchBody, ListMatchesQueryParams, GetMatchSuggestionsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

const LEVELS = ["D-", "D", "D+", "C-", "C", "C+"];
const LEVEL_INDEX = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

function formatPlayers(playersJson: string) {
  try { return JSON.parse(playersJson); } catch { return []; }
}

function formatMatch(m: typeof matchesTable.$inferSelect) {
  let playerRatings: Record<string, number> = {};
  try { playerRatings = JSON.parse(m.playerRatings); } catch { /* ignore */ }
  return {
    id: m.id,
    date: m.date,
    time: m.time,
    clubName: m.clubName,
    format: m.format,
    players: formatPlayers(m.players),
    status: m.status,
    price: m.price,
    levelMin: m.levelMin ?? null,
    levelMax: m.levelMax ?? null,
    matchType: m.matchType,
    balanceScore: m.balanceScore ?? null,
    setScores: m.setScores,
    playerRatings,
    conflictOccurred: m.conflictOccurred === "true",
    overallNote: m.overallNote,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/matches", async (req, res): Promise<void> => {
  const params = ListMatchesQueryParams.safeParse(req.query);
  let matches = await db.select().from(matchesTable).orderBy(matchesTable.date);

  if (params.success) {
    if (params.data.status) {
      matches = matches.filter(m => m.status === params.data.status);
    }
    if (params.data.format) {
      matches = matches.filter(m => m.format === params.data.format);
    }
    if (params.data.date) {
      matches = matches.filter(m => m.date === params.data.date);
    }
    if (params.data.level) {
      matches = matches.filter(m => m.levelMin === params.data.level || m.levelMax === params.data.level);
    }
  }

  res.json(matches.map(formatMatch));
});

router.post("/matches", async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { date, time, clubName, format, playerIds, matchType } = parsed.data;

  const playerDocs = await Promise.all(
    playerIds.map(pid => db.select().from(usersTable).where(eq(usersTable.id, pid)).then(rows => rows[0]))
  );

  const validPlayers = playerDocs.filter(Boolean);
  const levels = validPlayers.map(p => LEVEL_INDEX[p.level] ?? 0);
  const levelMin = LEVELS[Math.min(...levels)] ?? null;
  const levelMax = LEVELS[Math.max(...levels)] ?? null;

  const players = validPlayers.map(p => ({
    userId: p.id,
    name: p.name,
    level: p.level,
    confirmed: false,
    avatar: p.avatar ?? null,
  }));

  const [match] = await db.insert(matchesTable).values({
    date,
    time,
    clubName,
    format,
    players: JSON.stringify(players),
    matchType,
    levelMin,
    levelMax,
    balanceScore: levels.length > 0 ? 100 - (Math.max(...levels) - Math.min(...levels)) * 20 : 100,
  }).returning();

  if (validPlayers[0]) {
    await db.insert(activityLogsTable).values({
      userId: validPlayers[0].id,
      userName: validPlayers[0].name,
      action: "match_created",
      details: `Match at ${clubName} on ${date}`,
    });
  }

  res.status(201).json(formatMatch(match));
});

router.get("/matches/suggestions", async (req, res): Promise<void> => {
  const params = GetMatchSuggestionsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const userId = params.data.userId;
  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!currentUser) { res.status(404).json({ error: "User not found" }); return; }

  const allMatches = await db.select().from(matchesTable)
    .where(eq(matchesTable.status, "suggested"));

  const suggestions = {
    best: null as ReturnType<typeof formatMatch> | null,
    balanced: null as ReturnType<typeof formatMatch> | null,
    challenging: null as ReturnType<typeof formatMatch> | null,
    easy: null as ReturnType<typeof formatMatch> | null,
  };

  for (const m of allMatches) {
    if (m.matchType === "best" && !suggestions.best) suggestions.best = formatMatch(m);
    if (m.matchType === "balanced" && !suggestions.balanced) suggestions.balanced = formatMatch(m);
    if (m.matchType === "challenging" && !suggestions.challenging) suggestions.challenging = formatMatch(m);
    if (m.matchType === "easy" && !suggestions.easy) suggestions.easy = formatMatch(m);
  }

  res.json(suggestions);
});

router.get("/matches/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(formatMatch(match));
});

router.patch("/matches/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const setObj: Record<string, unknown> = {};
  if (req.body.status) setObj.status = req.body.status;
  if (req.body.format) setObj.format = req.body.format;
  if (req.body.clubName) setObj.clubName = req.body.clubName;
  if (req.body.setScores !== undefined) setObj.setScores = req.body.setScores;
  if (req.body.playerRatings !== undefined) setObj.playerRatings = JSON.stringify(req.body.playerRatings);
  if (req.body.conflictOccurred !== undefined) setObj.conflictOccurred = String(req.body.conflictOccurred);
  if (req.body.overallNote !== undefined) setObj.overallNote = req.body.overallNote;

  if (Object.keys(setObj).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [match] = await db.update(matchesTable).set(setObj as any).where(eq(matchesTable.id, id)).returning();
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(formatMatch(match));
});

export { formatMatch };
export default router;
