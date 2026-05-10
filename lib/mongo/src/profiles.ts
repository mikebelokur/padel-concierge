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
      $inc: { sessionStreak: 1 },
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

export async function recordNoShow(userId: number): Promise<void> {
  const col = playerProfiles();
  if (!col) return;

  await col.updateOne(
    { userId },
    {
      $setOnInsert: {
        reliabilityScore: 75,
        sessionStreak: 0,
        behavioralFlags: [],
        last30MatchIds: [],
      },
      $inc: { noShowCount: 1 },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );

  await col.updateOne(
    { userId },
    [
      {
        $set: {
          reliabilityScore: {
            $max: [10, { $subtract: ["$reliabilityScore", 5] }],
          },
        },
      },
    ]
  );
}
