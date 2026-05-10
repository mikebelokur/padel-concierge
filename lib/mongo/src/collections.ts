import { getMongoDb } from "./client.js";
import type { PlayerProfile, MatchLog, FeedbackAggregate, CompatibilityScore } from "./types.js";
import type { Collection } from "mongodb";

export function playerProfiles(): Collection<PlayerProfile> | null {
  return getMongoDb()?.collection<PlayerProfile>("player_profiles") ?? null;
}

export function matchLogs(): Collection<MatchLog> | null {
  return getMongoDb()?.collection<MatchLog>("match_logs") ?? null;
}

export function feedbackAggregates(): Collection<FeedbackAggregate> | null {
  return getMongoDb()?.collection<FeedbackAggregate>("feedback_aggregates") ?? null;
}

export function compatibilityScores(): Collection<CompatibilityScore> | null {
  return getMongoDb()?.collection<CompatibilityScore>("compatibility_scores") ?? null;
}
