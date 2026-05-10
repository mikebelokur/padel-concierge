import { matchLogs } from "./collections.js";
import type { MatchLog, ParticipantSnapshot, ConflictEvent, SetScore } from "./types.js";

function parseSetScores(raw: string): SetScore[] {
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

export interface UpsertMatchLogInput {
  matchId: number;
  date: string;
  participants: ParticipantSnapshot[];
  setScores?: string;
  conflictOccurred?: boolean;
  overallNote?: string;
}

export async function upsertMatchLog(input: UpsertMatchLogInput): Promise<void> {
  const col = matchLogs();
  if (!col) return;

  const conflictEvents: ConflictEvent[] = input.conflictOccurred
    ? [
        {
          timestamp: new Date(),
          description: input.overallNote ?? "Conflict occurred during match",
          involvedUserIds: input.participants.map((p) => p.userId),
        },
      ]
    : [];

  const setScoresParsed: SetScore[] = parseSetScores(input.setScores ?? "");

  await col.updateOne(
    { matchId: input.matchId },
    {
      $set: {
        date: input.date,
        participants: input.participants,
        setScores: setScoresParsed,
        rawSetScores: input.setScores ?? "",
        conflictEvents,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        timeline: [{ timestamp: new Date(), event: "match_created" }],
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function appendMatchTimeline(matchId: number, event: string): Promise<void> {
  const col = matchLogs();
  if (!col) return;

  await col.updateOne(
    { matchId },
    {
      $push: { timeline: { timestamp: new Date(), event } } as Record<string, unknown>,
      $set: { updatedAt: new Date() },
    }
  );
}
