import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router: IRouter = Router();
router.use(requireAuth);

// ─── Level ordering ─────────────────────────────────────────────────────────
const LEVEL_ORDER = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A"];

function levelIdx(l: string | null | undefined): number {
  if (!l) return -1;
  const i = LEVEL_ORDER.indexOf(l);
  return i >= 0 ? i : -1;
}

function scoreLevelMatch(a: string | null | undefined, b: string | null | undefined): number {
  const ai = levelIdx(a);
  const bi = levelIdx(b);
  if (ai < 0 || bi < 0) return 50;
  const diff = Math.abs(ai - bi);
  if (diff === 0) return 100;
  if (diff === 1) return 70;
  if (diff === 2) return 40;
  return 0;
}

// ─── Physical match ──────────────────────────────────────────────────────────
function scorePhysicalMatch(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null) return 50;
  const diff = Math.abs(a - b);
  if (diff <= 2) return 100;
  if (diff <= 4) return 60;
  return 20;
}

// ─── Archetype match ─────────────────────────────────────────────────────────
const ATTACKER_ARCHETYPES = new Set([
  "pro-ambitious",
  "competitive-improver",
  "smart attacker",
  "tactical thinker",
]);
const DEFENDER_ARCHETYPES = new Set([
  "patient defender",
  "balanced-competitor",
  "social-enjoyer",
  "casual-recreational",
  "social player",
]);

function archetypeCategory(a: string | null | undefined): "attacker" | "defender" | null {
  if (!a) return null;
  if (ATTACKER_ARCHETYPES.has(a)) return "attacker";
  if (DEFENDER_ARCHETYPES.has(a)) return "defender";
  return null;
}

function scoreArchetypeMatch(a: string | null | undefined, b: string | null | undefined): number {
  if (a != null && a === b) return 100;
  const catA = archetypeCategory(a);
  const catB = archetypeCategory(b);
  if (catA && catB && catA === catB) return 70;
  return 50;
}

// ─── Availability overlap ────────────────────────────────────────────────────
interface Slot {
  start: string;
  end: string;
}

function parseSlots(raw: string): Slot[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Slot => typeof s?.start === "string" && typeof s?.end === "string",
    );
  } catch {
    return [];
  }
}

function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

function computeTimeOverlap(
  mySlots: Slot[],
  theirSlots: Slot[],
  targetDate?: string,
): { score: number; sharedSlots: { start: string; end: string }[] } {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let maxOverlapMin = 0;
  const sharedSlots: { start: string; end: string }[] = [];

  for (const mine of mySlots) {
    const mStart = new Date(mine.start);
    const mEnd = new Date(mine.end);
    if (mEnd <= now || mStart >= windowEnd) continue;
    if (targetDate && mStart.toISOString().slice(0, 10) !== targetDate) continue;

    for (const theirs of theirSlots) {
      const tStart = new Date(theirs.start);
      const tEnd = new Date(theirs.end);
      if (tEnd <= now || tStart >= windowEnd) continue;
      if (targetDate && tStart.toISOString().slice(0, 10) !== targetDate) continue;

      const ms = overlapMs(mStart, mEnd, tStart, tEnd);
      const overlapMin = ms / 60000;

      if (overlapMin >= 30) {
        const overlapStart = new Date(Math.max(mStart.getTime(), tStart.getTime()));
        const overlapEnd = new Date(Math.min(mEnd.getTime(), tEnd.getTime()));
        sharedSlots.push({
          start: overlapStart.toISOString(),
          end: overlapEnd.toISOString(),
        });
        if (overlapMin > maxOverlapMin) maxOverlapMin = overlapMin;
      }
    }
  }

  const score = maxOverlapMin >= 90 ? 100 : maxOverlapMin >= 30 ? 50 : 0;
  return { score, sharedSlots };
}

// ─── Request schema ──────────────────────────────────────────────────────────
const SuggestBodySchema = z.object({
  date: z.string().optional(),
  count: z.number().min(1).max(10).default(5),
});

// ─── POST /matchmaking/suggest ───────────────────────────────────────────────
router.post("/matchmaking/suggest", async (req, res): Promise<void> => {
  const parsed = SuggestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  // Always use the authenticated user's id — never trust client-supplied userId.
  const auth = (req as any).auth as { userId: number };
  const userId = auth.userId;
  const { date, count } = parsed.data;

  const allUsers = await db.select().from(usersTable);
  const me = allUsers.find((u) => u.id === userId);
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!me.level || me.level.trim() === "") {
    res.status(400).json({
      error: "Level not set. Please complete the level assessment first.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const mySlots = parseSlots(me.availability);

  const candidates: {
    user: {
      id: number;
      name: string;
      level_self: number | null;
      level_quiz: string | null;
      archetype: string | null;
      warmup_format: string | null;
      physical_self: number | null;
      location_name: string | null;
      goal: string | null;
    };
    isBeta: boolean;
    compatibility_score: number;
    compatibility_breakdown: {
      level_match: number;
      physical_match: number;
      archetype_match: number;
      time_overlap: number;
    };
    shared_availability_slots: { start: string; end: string }[];
  }[] = [];

  const myUserType = me.userType ?? "real_user";

  for (const u of allUsers) {
    if (u.id === userId) continue;
    if (u.role !== "player") continue;
    if (!u.verified) continue;
    if (!["approved", "active"].includes(u.approvalStatus)) continue;

    // Segment by user type: seed↔seed, real/beta↔real/beta
    const uType = u.userType ?? "real_user";
    if (myUserType === "seed_test") {
      if (uType !== "seed_test") continue;
    } else {
      if (uType === "seed_test") continue;
    }

    const theirSlots = parseSlots(u.availability);
    const lm = scoreLevelMatch(me.levelQuiz, u.levelQuiz);
    const pm = scorePhysicalMatch(me.physicalSelf, u.physicalSelf);
    const am = scoreArchetypeMatch(me.archetype, u.archetype);
    const { score: tm, sharedSlots } = computeTimeOverlap(mySlots, theirSlots, date);

    if (tm === 0) continue;

    const score = Math.round(lm * 0.4 + pm * 0.2 + am * 0.2 + tm * 0.2);

    candidates.push({
      user: {
        id: u.id,
        name: u.name,
        level_self: u.levelSelf,
        level_quiz: u.levelQuiz,
        archetype: u.archetype,
        warmup_format: u.warmupFormat,
        physical_self: u.physicalSelf,
        location_name: u.locationName,
        goal: u.goal,
      },
      isBeta: (u.userType ?? "real_user") === "beta_tester",
      compatibility_score: score,
      compatibility_breakdown: {
        level_match: lm,
        physical_match: pm,
        archetype_match: am,
        time_overlap: tm,
      },
      shared_availability_slots: sharedSlots,
    });
  }

  candidates.sort((a, b) => b.compatibility_score - a.compatibility_score);
  res.json({ candidates: candidates.slice(0, Math.min(count, 10)) });
});

export default router;
