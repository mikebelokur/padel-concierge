import { playerProfiles } from "./collections.js";
import type { PlayerProfile } from "./types.js";

export async function getOrCreateProfile(userId: number): Promise<PlayerProfile | null> {
  const col = playerProfiles();
  if (!col) return null;

  const existing = await col.findOne({ userId });
  if (existing) return existing;

  const profile: PlayerProfile = {
    userId,
    reliabilityScore: 75,
    noShowCount: 0,
    sessionStreak: 0,
    behavioralFlags: [],
    last30MatchIds: [],
    updatedAt: new Date(),
  };

  await col.insertOne(profile);
  return profile;
}

export async function upsertProfileMatchRecord(userId: number, matchId: number): Promise<void> {
  const col = playerProfiles();
  if (!col) return;

  await col.updateOne(
    { userId },
    {
      $setOnInsert: {
        reliabilityScore: 75,
        noShowCount: 0,
        sessionStreak: 0,
        behavioralFlags: [],
      },
      $addToSet: { last30MatchIds: matchId } as Record<string, unknown>,
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  await col.updateOne(
    { userId },
    [
      {
        $set: {
          last30MatchIds: {
            $slice: ["$last30MatchIds", -30],
          },
        },
      },
    ]
  );
}

/**
 * Increment sessionStreak for a player who attended a completed match.
 * Called only on match outcome, not at match creation.
 */
export async function recordAttendance(userId: number): Promise<void> {
  const col = playerProfiles();
  if (!col) return;

  await col.updateOne(
    { userId },
    {
      $setOnInsert: {
        reliabilityScore: 75,
        noShowCount: 0,
        behavioralFlags: [],
        last30MatchIds: [],
      },
      $inc: { sessionStreak: 1 },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
}

export async function patchPlayerProfile(
  userId: number,
  patch: { addFlags?: string[]; removeFlags?: string[]; reliabilityScore?: number }
): Promise<PlayerProfile | null> {
  const col = playerProfiles();
  if (!col) return null;

  const existing = await col.findOne({ userId });
  if (!existing) {
    const base: PlayerProfile = {
      userId,
      reliabilityScore: patch.reliabilityScore ?? 75,
      noShowCount: 0,
      sessionStreak: 0,
      behavioralFlags: patch.addFlags ?? [],
      last30MatchIds: [],
      updatedAt: new Date(),
    };
    await col.insertOne(base);
    return base;
  }

  let flags = [...existing.behavioralFlags];
  if (patch.addFlags) {
    for (const f of patch.addFlags) {
      if (!flags.includes(f)) flags.push(f);
    }
  }
  if (patch.removeFlags) {
    flags = flags.filter(f => !patch.removeFlags!.includes(f));
  }

  const update: Partial<PlayerProfile> & { updatedAt: Date } = { updatedAt: new Date() };
  update.behavioralFlags = flags;
  if (patch.reliabilityScore !== undefined) {
    update.reliabilityScore = Math.max(0, Math.min(100, patch.reliabilityScore));
  }

  await col.updateOne({ userId }, { $set: update });
  return { ...existing, ...update };
}

export async function recordNoShow(userId: number): Promise<void> {
  const col = playerProfiles();
  if (!col) return;

  await col.updateOne(
    { userId },
    {
      $setOnInsert: {
        behavioralFlags: [],
        last30MatchIds: [],
      },
      $inc: { noShowCount: 1 },
      $set: { sessionStreak: 0, updatedAt: new Date() },
    },
    { upsert: true }
  );

  // Recalculate reliabilityScore: 100 - (noShowCount * 10), capped 0–100
  await col.updateOne(
    { userId },
    [
      {
        $set: {
          reliabilityScore: {
            $max: [0, { $min: [100, { $subtract: [100, { $multiply: ["$noShowCount", 10] }] }] }],
          },
        },
      },
    ]
  );
}
