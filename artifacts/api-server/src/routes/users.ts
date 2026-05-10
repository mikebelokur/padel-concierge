import { Router, type IRouter } from "express";
import { db, usersTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateUserBody, UpdateAvailabilityBody, AddFavouriteBody, RemoveFavouriteBody } from "@workspace/api-zod";
import { formatUser } from "./auth";
import {
  getOrCreateProfile,
  computeAndCacheCompatibility,
  getCachedCompatibility,
} from "@workspace/mongo";

const router: IRouter = Router();

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(formatUser));
});

const LEVEL_ORDER = [
  "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A",
  "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0",
];
function levelIdx(l: string): number {
  const i = LEVEL_ORDER.indexOf(l);
  return i >= 0 ? i : 4;
}

router.get("/users/find-matches", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.query.userId), 10);
  if (!userId || isNaN(userId)) { res.status(400).json({ error: "userId required" }); return; }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const allUsers = await db.select().from(usersTable);
  const others = allUsers.filter(u => u.id !== userId && u.approvalStatus === "approved");

  const myLvl = levelIdx(me.level);

  type Candidate = {
    user: typeof usersTable.$inferSelect;
    skillDiff: number;
    archetypeMatch: boolean;
    priority: number;
    compatibilityScore: number;
  };

  const candidates: Candidate[] = [];
  for (const u of others) {
    const uLvl = levelIdx(u.level);
    const skillDiff = Math.abs(myLvl - uLvl);
    const archetypeMatch = !!(me.archetype && u.archetype && me.archetype === u.archetype);

    if (archetypeMatch && skillDiff <= 2) {
      candidates.push({ user: u, skillDiff, archetypeMatch, priority: 1, compatibilityScore: 0 });
    } else if (skillDiff <= 3) {
      candidates.push({ user: u, skillDiff, archetypeMatch, priority: 2, compatibilityScore: 0 });
    }
  }

  await Promise.all(
    candidates.map(async (c) => {
      const score = await computeAndCacheCompatibility(
        { id: me.id, level: me.level, archetype: me.archetype ?? null },
        { id: c.user.id, level: c.user.level, archetype: c.user.archetype ?? null }
      );
      c.compatibilityScore = score?.score ?? 50;
    })
  );

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.compatibilityScore - a.compatibilityScore;
  });

  const top3 = candidates.slice(0, 3);

  res.json({
    matches: top3.map(c => ({
      ...formatUser(c.user),
      skillDiff: c.skillDiff,
      archetypeMatch: c.archetypeMatch,
      priority: c.priority,
      compatibilityScore: c.compatibilityScore,
    })),
    noMatchesMessage: top3.length === 0
      ? "Подходящих игроков пока нет. Попробуй позже или расширь время доступности."
      : null,
  });
});

router.get("/players/:id/profile", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid player id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Player not found" }); return; }

  const profile = await getOrCreateProfile(id);
  if (!profile) {
    res.json({
      userId: id,
      reliabilityScore: 75,
      noShowCount: 0,
      sessionStreak: 0,
      behavioralFlags: [],
      last30MatchIds: [],
      source: "default",
    });
    return;
  }

  res.json({
    userId: profile.userId,
    reliabilityScore: profile.reliabilityScore,
    noShowCount: profile.noShowCount,
    sessionStreak: profile.sessionStreak,
    behavioralFlags: profile.behavioralFlags,
    last30MatchIds: profile.last30MatchIds,
    updatedAt: profile.updatedAt,
    source: "mongodb",
  });
});

router.get("/players/:id/compatibility/:otherId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const otherId = parseInt(Array.isArray(req.params.otherId) ? req.params.otherId[0] : req.params.otherId, 10);

  if (isNaN(id) || isNaN(otherId)) { res.status(400).json({ error: "Invalid player ids" }); return; }

  const [playerA] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  const [playerB] = await db.select().from(usersTable).where(eq(usersTable.id, otherId));

  if (!playerA) { res.status(404).json({ error: "Player not found" }); return; }
  if (!playerB) { res.status(404).json({ error: "Other player not found" }); return; }

  const score = await computeAndCacheCompatibility(
    { id: playerA.id, level: playerA.level, archetype: playerA.archetype ?? null },
    { id: playerB.id, level: playerB.level, archetype: playerB.archetype ?? null }
  );

  if (score) {
    res.json({ score: score.score, factors: score.factors, computedAt: score.computedAt, source: "mongodb" });
    return;
  }

  res.json({ score: 50, factors: null, computedAt: null, source: "fallback" });
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.update(usersTable).set({
    ...(parsed.data.name && { name: parsed.data.name }),
    ...(parsed.data.phone && { phone: parsed.data.phone }),
    ...(parsed.data.level && { level: parsed.data.level }),
    ...(parsed.data.goal && { goal: parsed.data.goal }),
    ...(parsed.data.intensity && { intensity: parsed.data.intensity }),
    ...(parsed.data.locationName !== undefined && { locationName: parsed.data.locationName }),
    ...(parsed.data.locationLat !== undefined && { locationLat: parsed.data.locationLat }),
    ...(parsed.data.locationLng !== undefined && { locationLng: parsed.data.locationLng }),
    ...(parsed.data.avatar !== undefined && { avatar: parsed.data.avatar }),
    ...(parsed.data.language && { language: parsed.data.language }),
  }).where(eq(usersTable.id, id)).returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id/availability", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateAvailabilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.update(usersTable).set({
    availability: JSON.stringify(parsed.data.availability),
  }).where(eq(usersTable.id, id)).returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(activityLogsTable).values({
    userId: id,
    userName: user.name,
    action: "updated_availability",
    details: null,
  });

  res.json(formatUser(user));
});

router.post("/users/:id/favourites", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = AddFavouriteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const existing = (user.favouritePlayers ?? []).map(Number);
  if (!existing.includes(parsed.data.targetUserId)) {
    existing.push(parsed.data.targetUserId);
  }

  const [updated] = await db.update(usersTable).set({
    favouritePlayers: existing.map(String),
  }).where(eq(usersTable.id, id)).returning();

  res.json(formatUser(updated));
});

router.delete("/users/:id/favourites", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = RemoveFavouriteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const filtered = (user.favouritePlayers ?? []).map(Number).filter(fid => fid !== parsed.data.targetUserId);
  const [updated] = await db.update(usersTable).set({
    favouritePlayers: filtered.map(String),
  }).where(eq(usersTable.id, id)).returning();

  res.json(formatUser(updated));
});

router.post("/users/:id/archetype", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { archetype, warmUpPreference } = req.body;
  if (!archetype) { res.status(400).json({ error: "archetype required" }); return; }

  const [user] = await db.update(usersTable).set({
    archetype,
    warmUpPreference: warmUpPreference ?? false,
  }).where(eq(usersTable.id, id)).returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(activityLogsTable).values({
    userId: user.id,
    userName: user.name,
    action: "archetype_set",
    details: `Архетип: ${archetype}${warmUpPreference ? " · предпочитает разминку" : ""}`,
  });

  res.json(formatUser(user));
});

router.post("/users/:id/verify", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [user] = await db.update(usersTable).set({
    verified: true,
    verificationDate: new Date(),
  }).where(eq(usersTable.id, id)).returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(activityLogsTable).values({
    userId: id,
    userName: user.name,
    action: "verified",
    details: "Player verified by coach",
  });

  res.json(formatUser(user));
});

export default router;
