import { compatibilityScores, feedbackAggregates, playerProfiles, matchLogs } from "./collections.js";
import type { CompatibilityScore } from "./types.js";

const CACHE_TTL_HOURS = 1;

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

async function computeHeadToHead(idA: number, idB: number): Promise<number> {
  const col = matchLogs();
  if (!col) return 50;

  const sharedMatches = await col
    .find({
      $and: [
        { "participants.userId": idA },
        { "participants.userId": idB },
      ],
    })
    .toArray();

  if (sharedMatches.length === 0) return 50;

  const conflictCount = sharedMatches.reduce((n, m) => n + m.conflictEvents.length, 0);
  const conflictRate = conflictCount / sharedMatches.length;

  let score = 70;
  if (sharedMatches.length >= 3) score += 15;
  else if (sharedMatches.length >= 1) score += 5;
  score -= Math.round(conflictRate * 30);

  return Math.min(100, Math.max(0, score));
}

export async function ensureTtlIndex(): Promise<void> {
  const col = compatibilityScores();
  if (!col) return;
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
}

export interface PlayerInfo {
  id: number;
  level: string;
  archetype: string | null;
}

export async function computeAndCacheCompatibility(
  playerA: PlayerInfo,
  playerB: PlayerInfo
): Promise<CompatibilityScore | null> {
  const col = compatibilityScores();
  if (!col) return null;

  const pairKey = makePairKey(playerA.id, playerB.id);

  const cached = await col.findOne({ pairKey });
  if (cached && cached.expiresAt > new Date()) {
    return cached;
  }

  const [profileA, profileB, feedA, feedB, headToHeadScore] = await Promise.all([
    playerProfiles()?.findOne({ userId: playerA.id }),
    playerProfiles()?.findOne({ userId: playerB.id }),
    feedbackAggregates()?.findOne({ userId: playerA.id }),
    feedbackAggregates()?.findOne({ userId: playerB.id }),
    computeHeadToHead(playerA.id, playerB.id),
  ]);

  const relA = profileA?.reliabilityScore ?? 75;
  const relB = profileB?.reliabilityScore ?? 75;
  const reliabilityDelta = 100 - Math.abs(relA - relB);

  const traitFreqA = feedA?.traitFrequency ?? {};
  const traitFreqB = feedB?.traitFrequency ?? {};

  const factors = {
    archetypeAlignment: archetypeAlignment(playerA.archetype, playerB.archetype),
    levelProximity: levelProximityScore(playerA.level, playerB.level),
    reliabilityDelta,
    feedbackTraitOverlap: traitOverlap(traitFreqA, traitFreqB),
    headToHead: headToHeadScore,
  };

  const score = Math.round(
    factors.archetypeAlignment * 0.30 +
    factors.levelProximity * 0.25 +
    factors.reliabilityDelta * 0.20 +
    factors.feedbackTraitOverlap * 0.10 +
    factors.headToHead * 0.15
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  const doc: CompatibilityScore = {
    pairKey,
    userIdA: playerA.id,
    userIdB: playerB.id,
    score: Math.min(100, Math.max(0, score)),
    factors,
    expiresAt,
    computedAt: now,
  };

  await col.replaceOne({ pairKey }, doc, { upsert: true });
  return doc;
}

export async function getCachedCompatibility(
  userIdA: number,
  userIdB: number
): Promise<CompatibilityScore | null> {
  const col = compatibilityScores();
  if (!col) return null;
  const pairKey = makePairKey(userIdA, userIdB);
  return col.findOne({ pairKey }) ?? null;
}
