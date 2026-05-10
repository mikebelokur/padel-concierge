import type { ObjectId } from "mongodb";

export interface PlayerProfile {
  _id?: ObjectId;
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

export interface TimelineEntry {
  timestamp: Date;
  event: string;
}

export interface SetScore {
  setNumber: number;
  teamA: number;
  teamB: number;
}

export interface MatchLog {
  _id?: ObjectId;
  matchId: number;
  date: string;
  participants: ParticipantSnapshot[];
  setScores: SetScore[];
  rawSetScores: string;
  conflictEvents: ConflictEvent[];
  timeline: TimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackAggregate {
  _id?: ObjectId;
  userId: number;
  totalRatings: number;
  averageRating: number;
  traitFrequency: Record<string, number>;
  anonymousReviewerCount: number;
  hashedReviewerIds: string[];
  updatedAt: Date;
}

export interface CompatibilityScore {
  _id?: ObjectId;
  pairKey: string;
  userIdA: number;
  userIdB: number;
  score: number;
  factors: {
    archetypeAlignment: number;
    levelProximity: number;
    reliabilityDelta: number;
    feedbackTraitOverlap: number;
    headToHead: number;
  };
  expiresAt: Date;
  computedAt: Date;
}
