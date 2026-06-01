import crypto from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "./client.js";
import {
  playerProfilesTable,
  matchLogsTable,
  feedbackAggregatesTable,
  compatibilityScoresTable,
} from "./schema/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerProfileData {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
  last30MatchIds: number[];
  updatedAt: Date;
}

export interface ParticipantSnapshot {
  userId: number;
  name: string;
  levelAtPlay: string;
  archetype: string | null;
}

export interface ConflictEvent {
  timestamp: Date;
  description: string;
  involvedUserIds: number[];
}

export interface SetScore {
  setNumber: number;
  teamA: number;
  teamB: number;
}

export interface TimelineEntry {
  timestamp: Date;
  event: string;
}

export interface CompatibilityFactors {
  archetypeAlignment: number;
  levelProximity: number;
  reliabilityDelta: number;
  feedbackTraitOverlap: number;
  headToHead: number;
}

export interface CompatibilityScoreData {
  pairKey: string;
  userIdA: number;
  userIdB: number;
  score: number;
  factors: CompatibilityFactors;
  expiresAt: Date;
  computedAt: Date;
}

export interface PlayerInfo {
  id: number;
  level: string;
  archetype: string | null;
}

export interface UpsertMatchLogInput {
  matchId: number;
  date: string;
  participants: ParticipantSnapshot[];
  setScores?: string;
  conflictOccurred?: boolean;
  overallNote?: string;
}

export interface FeedbackInput {
  aboutUserId: number;
  fromUserId: number;
  rating: number;
  traits: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): Date {
  return new Date();
}

export function parseSetScores(raw: string): SetScore[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as Array<{ setNumber?: number; teamA?: number; teamB?: number }>)
        .filter((s) => typeof s === "object" && s !== null)
        .map((s, i) => ({
          setNumber: typeof s.setNumber === "number" ? s.setNumber : i + 1,
          teamA: typeof s.teamA === "number" ? s.teamA : 0,
          teamB: typeof s.teamB === "number" ? s.teamB : 0,
        }));
    }
  } catch {
    /* not JSON — try "6-4,7-5" style */
  }
  return raw.split(",").map((part, i) => {
    const [a, b] = part.trim().split("-").map(Number);
    return { setNumber: i + 1, teamA: isNaN(a) ? 0 : a, teamB: isNaN(b) ? 0 : b };
  }).filter((s) => s.teamA !== 0 || s.teamB !== 0);
}

function hashReviewerId(userId: number): string {
  return crypto.createHash("sha256").update(String(userId)).digest("hex");
}

const LEVEL_ORDER = [
  "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A",
  "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0",
];

const ARCHETYPES = [
  "pro-ambitious",
  "competitive-improver",
  "balanced-competitor",
  "social-enjoyer",
  "casual-recreational",
];

function levelIndex(level: string): number {
  const i = LEVEL_ORDER.indexOf(level);
  return i >= 0 ? i : 4;
}

function makePairKey(a: number, b: number): string {
  return [Math.min(a, b), Math.max(a, b)].join(":");
}

function archetypeAlignment(archetypeA: string | null, archetypeB: string | null): number {
  if (!archetypeA || !archetypeB) return 50;
  if (archetypeA === archetypeB) return 100;
  const idxA = ARCHETYPES.indexOf(archetypeA);
  const idxB = ARCHETYPES.indexOf(archetypeB);
  if (idxA < 0 || idxB < 0) return 50;
  const dist = Math.abs(idxA - idxB);
  if (dist === 1) return 75;
  if (dist === 2) return 55;
  return 30;
}

function levelProximityScore(levelA: string, levelB: string): number {
  const diff = Math.abs(levelIndex(levelA) - levelIndex(levelB));
  if (diff === 0) return 100;
  if (diff === 1) return 80;
  if (diff === 2) return 55;
  if (diff === 3) return 30;
  return 10;
}

function traitOverlap(freqA: Record<string, number>, freqB: Record<string, number>): number {
  const traitsA = new Set(Object.keys(freqA));
  const traitsB = new Set(Object.keys(freqB));
  if (traitsA.size === 0 || traitsB.size === 0) return 50;
  const intersection = [...traitsA].filter((t) => traitsB.has(t)).length;
  const union = new Set([...traitsA, ...traitsB]).size;
  return Math.round((intersection / union) * 100);
}

function rowToProfile(row: typeof playerProfilesTable.$inferSelect): PlayerProfileData {
  return {
    userId: row.userId,
    reliabilityScore: row.reliabilityScore,
    noShowCount: row.noShowCount,
    sessionStreak: row.sessionStreak,
    behavioralFlags: row.behavioralFlags ?? [],
    last30MatchIds: (row.last30MatchIds as number[]) ?? [],
    updatedAt: row.updatedAt,
  };
}

// ─── Player Profiles ─────────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: number): Promise<PlayerProfileData> {
  const [existing] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.userId, userId));

  if (existing) return rowToProfile(existing);

  const [created] = await db
    .insert(playerProfilesTable)
    .values({
      userId,
      reliabilityScore: 75,
      noShowCount: 0,
      sessionStreak: 0,
      behavioralFlags: [],
      last30MatchIds: [],
      updatedAt: now(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return rowToProfile(created);

  // Race condition: another insert won; fetch the row that won
  const [fetched] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.userId, userId));
  return rowToProfile(fetched!);
}

export async function upsertProfileMatchRecord(userId: number, matchId: number): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const updated = [...new Set([...profile.last30MatchIds, matchId])].slice(-30);

  await db
    .update(playerProfilesTable)
    .set({ last30MatchIds: updated, updatedAt: now() })
    .where(eq(playerProfilesTable.userId, userId));
}

export async function recordAttendance(userId: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.userId, userId));

  if (existing) {
    await db
      .update(playerProfilesTable)
      .set({ sessionStreak: existing.sessionStreak + 1, updatedAt: now() })
      .where(eq(playerProfilesTable.userId, userId));
  } else {
    await db
      .insert(playerProfilesTable)
      .values({
        userId,
        reliabilityScore: 75,
        noShowCount: 0,
        sessionStreak: 1,
        behavioralFlags: [],
        last30MatchIds: [],
        updatedAt: now(),
      })
      .onConflictDoNothing();
  }
}

export async function patchPlayerProfile(
  userId: number,
  patch: { addFlags?: string[]; removeFlags?: string[]; reliabilityScore?: number }
): Promise<PlayerProfileData> {
  const profile = await getOrCreateProfile(userId);

  let flags = [...profile.behavioralFlags];
  if (patch.addFlags) {
    for (const f of patch.addFlags) {
      if (!flags.includes(f)) flags.push(f);
    }
  }
  if (patch.removeFlags) {
    flags = flags.filter((f) => !patch.removeFlags!.includes(f));
  }

  const newScore =
    patch.reliabilityScore !== undefined
      ? Math.max(0, Math.min(100, patch.reliabilityScore))
      : profile.reliabilityScore;

  const updatedAt = now();

  await db
    .update(playerProfilesTable)
    .set({ behavioralFlags: flags, reliabilityScore: newScore, updatedAt })
    .where(eq(playerProfilesTable.userId, userId));

  return { ...profile, behavioralFlags: flags, reliabilityScore: newScore, updatedAt };
}

export async function recordNoShow(userId: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.userId, userId));

  if (existing) {
    const newNoShowCount = existing.noShowCount + 1;
    const newScore = Math.max(0, Math.min(100, 100 - newNoShowCount * 10));
    await db
      .update(playerProfilesTable)
      .set({ noShowCount: newNoShowCount, sessionStreak: 0, reliabilityScore: newScore, updatedAt: now() })
      .where(eq(playerProfilesTable.userId, userId));
  } else {
    await db
      .insert(playerProfilesTable)
      .values({
        userId,
        reliabilityScore: 90,
        noShowCount: 1,
        sessionStreak: 0,
        behavioralFlags: [],
        last30MatchIds: [],
        updatedAt: now(),
      })
      .onConflictDoNothing();
  }
}

// ─── Match Logs ───────────────────────────────────────────────────────────────

export async function upsertMatchLog(input: UpsertMatchLogInput): Promise<void> {
  const conflictEvents: ConflictEvent[] = input.conflictOccurred
    ? [
        {
          timestamp: now(),
          description: input.overallNote ?? "Conflict occurred during match",
          involvedUserIds: input.participants.map((p) => p.userId),
        },
      ]
    : [];

  const setScoresParsed: SetScore[] = parseSetScores(input.setScores ?? "");

  const [existing] = await db
    .select({ id: matchLogsTable.id, timeline: matchLogsTable.timeline, createdAt: matchLogsTable.createdAt })
    .from(matchLogsTable)
    .where(eq(matchLogsTable.matchId, input.matchId));

  if (existing) {
    await db
      .update(matchLogsTable)
      .set({
        date: input.date,
        participants: input.participants,
        setScores: setScoresParsed,
        rawSetScores: input.setScores ?? "",
        conflictEvents,
        updatedAt: now(),
      })
      .where(eq(matchLogsTable.matchId, input.matchId));
  } else {
    await db
      .insert(matchLogsTable)
      .values({
        matchId: input.matchId,
        date: input.date,
        participants: input.participants,
        setScores: setScoresParsed,
        rawSetScores: input.setScores ?? "",
        conflictEvents,
        timeline: [{ timestamp: now(), event: "match_created" }],
        createdAt: now(),
        updatedAt: now(),
      })
      .onConflictDoNothing();
  }
}

export async function appendMatchTimeline(matchId: number, event: string): Promise<void> {
  const [existing] = await db
    .select({ timeline: matchLogsTable.timeline })
    .from(matchLogsTable)
    .where(eq(matchLogsTable.matchId, matchId));

  if (!existing) return;

  const timeline = [...((existing.timeline as TimelineEntry[]) ?? []), { timestamp: now(), event }];

  await db
    .update(matchLogsTable)
    .set({ timeline, updatedAt: now() })
    .where(eq(matchLogsTable.matchId, matchId));
}

// ─── Feedback Aggregates ──────────────────────────────────────────────────────

export async function upsertFeedbackAggregate(input: FeedbackInput): Promise<void> {
  const hashedId = hashReviewerId(input.fromUserId);

  const [existing] = await db
    .select()
    .from(feedbackAggregatesTable)
    .where(eq(feedbackAggregatesTable.userId, input.aboutUserId));

  if (!existing) {
    const traitFreq: Record<string, number> = {};
    for (const t of input.traits) {
      traitFreq[t] = 1;
    }
    await db
      .insert(feedbackAggregatesTable)
      .values({
        userId: input.aboutUserId,
        totalRatings: 1,
        averageRating: input.rating,
        traitFrequency: traitFreq,
        anonymousReviewerCount: 1,
        hashedReviewerIds: [hashedId],
        updatedAt: now(),
      })
      .onConflictDoNothing();
    return;
  }

  const alreadyReviewed = existing.hashedReviewerIds.includes(hashedId);
  const newTotal = existing.totalRatings + 1;
  const newAvg = Math.round(((existing.averageRating * existing.totalRatings + input.rating) / newTotal) * 100) / 100;

  const traitFreq = { ...(existing.traitFrequency as Record<string, number>) };
  for (const t of input.traits) {
    traitFreq[t] = (traitFreq[t] ?? 0) + 1;
  }

  await db
    .update(feedbackAggregatesTable)
    .set({
      totalRatings: newTotal,
      averageRating: newAvg,
      traitFrequency: traitFreq,
      anonymousReviewerCount: alreadyReviewed ? existing.anonymousReviewerCount : existing.anonymousReviewerCount + 1,
      hashedReviewerIds: alreadyReviewed ? existing.hashedReviewerIds : [...existing.hashedReviewerIds, hashedId],
      updatedAt: now(),
    })
    .where(eq(feedbackAggregatesTable.userId, input.aboutUserId));
}

// ─── Compatibility ────────────────────────────────────────────────────────────

const CACHE_TTL_HOURS = 1;

async function computeHeadToHead(idA: number, idB: number): Promise<number> {
  // Use JSONB containment operators to filter in SQL — avoids loading all match_logs
  const sharedMatches = await db
    .select({
      conflictEvents: matchLogsTable.conflictEvents,
    })
    .from(matchLogsTable)
    .where(
      and(
        sql`${matchLogsTable.participants} @> ${JSON.stringify([{ userId: idA }])}::jsonb`,
        sql`${matchLogsTable.participants} @> ${JSON.stringify([{ userId: idB }])}::jsonb`
      )
    );

  if (sharedMatches.length === 0) return 50;

  const conflictCount = sharedMatches.reduce(
    (n, m) => n + ((m.conflictEvents as ConflictEvent[]) ?? []).length,
    0
  );
  const conflictRate = conflictCount / sharedMatches.length;

  let score = 70;
  if (sharedMatches.length >= 3) score += 15;
  else if (sharedMatches.length >= 1) score += 5;
  score -= Math.round(conflictRate * 30);

  return Math.min(100, Math.max(0, score));
}

export async function computeAndCacheCompatibility(
  playerA: PlayerInfo,
  playerB: PlayerInfo
): Promise<CompatibilityScoreData> {
  const pairKey = makePairKey(playerA.id, playerB.id);

  const [cached] = await db
    .select()
    .from(compatibilityScoresTable)
    .where(eq(compatibilityScoresTable.pairKey, pairKey));

  if (cached && cached.expiresAt > new Date()) {
    return {
      pairKey: cached.pairKey,
      userIdA: cached.userIdA,
      userIdB: cached.userIdB,
      score: cached.score,
      factors: cached.factors as CompatibilityFactors,
      expiresAt: cached.expiresAt,
      computedAt: cached.computedAt,
    };
  }

  const [profileARow, profileBRow, feedARow, feedBRow, headToHeadScore] = await Promise.all([
    db.select().from(playerProfilesTable).where(eq(playerProfilesTable.userId, playerA.id)).then((r) => r[0]),
    db.select().from(playerProfilesTable).where(eq(playerProfilesTable.userId, playerB.id)).then((r) => r[0]),
    db.select().from(feedbackAggregatesTable).where(eq(feedbackAggregatesTable.userId, playerA.id)).then((r) => r[0]),
    db.select().from(feedbackAggregatesTable).where(eq(feedbackAggregatesTable.userId, playerB.id)).then((r) => r[0]),
    computeHeadToHead(playerA.id, playerB.id),
  ]);

  const relA = profileARow?.reliabilityScore ?? 75;
  const relB = profileBRow?.reliabilityScore ?? 75;
  const reliabilityDelta = 100 - Math.abs(relA - relB);

  const traitFreqA = (feedARow?.traitFrequency as Record<string, number>) ?? {};
  const traitFreqB = (feedBRow?.traitFrequency as Record<string, number>) ?? {};

  const factors: CompatibilityFactors = {
    archetypeAlignment: archetypeAlignment(playerA.archetype, playerB.archetype),
    levelProximity: levelProximityScore(playerA.level, playerB.level),
    reliabilityDelta,
    feedbackTraitOverlap: traitOverlap(traitFreqA, traitFreqB),
    headToHead: headToHeadScore,
  };

  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        factors.archetypeAlignment * 0.3 +
          factors.levelProximity * 0.25 +
          factors.reliabilityDelta * 0.2 +
          factors.feedbackTraitOverlap * 0.1 +
          factors.headToHead * 0.15
      )
    )
  );

  const computedAt = now();
  const expiresAt = new Date(computedAt.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  await db
    .insert(compatibilityScoresTable)
    .values({ pairKey, userIdA: playerA.id, userIdB: playerB.id, score, factors, expiresAt, computedAt })
    .onConflictDoUpdate({
      target: compatibilityScoresTable.pairKey,
      set: { score, factors, expiresAt, computedAt },
    });

  return { pairKey, userIdA: playerA.id, userIdB: playerB.id, score, factors, expiresAt, computedAt };
}

export async function getCachedCompatibility(
  userIdA: number,
  userIdB: number
): Promise<CompatibilityScoreData | null> {
  const pairKey = makePairKey(userIdA, userIdB);
  const [row] = await db
    .select()
    .from(compatibilityScoresTable)
    .where(and(eq(compatibilityScoresTable.pairKey, pairKey)));

  if (!row) return null;
  return {
    pairKey: row.pairKey,
    userIdA: row.userIdA,
    userIdB: row.userIdB,
    score: row.score,
    factors: row.factors as CompatibilityFactors,
    expiresAt: row.expiresAt,
    computedAt: row.computedAt,
  };
}
