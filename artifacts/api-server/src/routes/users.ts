import { Router, type IRouter } from "express";
import { db, usersTable, activityLogsTable, coachingClientsTable, getOrCreateProfile, computeAndCacheCompatibility, patchPlayerProfile } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateUserBody, UpdateAvailabilityBody, AddFavouriteBody, RemoveFavouriteBody } from "@workspace/api-zod";
import { z } from "zod";
import { formatUser } from "./auth";
import { getTokenFromRequest, verifyToken } from "../lib/auth";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

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
  const auth = (req as any).auth as { userId: number; role: string };
  const isPrivileged = ["coach", "admin", "owner"].includes(auth.role);
  const requestedId = req.query.userId ? parseInt(String(req.query.userId), 10) : auth.userId;
  if (!requestedId || isNaN(requestedId)) { res.status(400).json({ error: "userId required" }); return; }
  // Players may only query find-matches for themselves; privileged roles may pass any userId.
  const userId = isPrivileged ? requestedId : auth.userId;

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  if (!me.level || me.level.trim() === "") {
    res.status(400).json({
      error: "Level not set. Please complete the level assessment first.",
      code: "LEVEL_REQUIRED",
    });
    return;
  }

  const allUsers = await db.select().from(usersTable);

  const myUserType = me.userType ?? "real_user";
  const others = allUsers.filter(u => {
    if (u.id === userId) return false;
    if (u.approvalStatus !== "approved") return false;
    const uType = u.userType ?? "real_user";
    if (myUserType === "seed_test") return uType === "seed_test";
    return uType === "real_user" || uType === "beta_tester";
  });

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
      isBeta: (c.user.userType ?? "real_user") === "beta_tester",
    })),
    noMatches: top3.length === 0,
    noMatchesMessage: top3.length === 0
      ? "Подходящих игроков пока нет. Попробуй позже или расширь время доступности."
      : null,
  });
});

function parsePgOverride(raw: string | null | undefined): { reliabilityScore?: number; behavioralFlags?: string[] } {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

type EntityKind = "user" | "coaching_client";
type ResolvedEntity = { kind: EntityKind; behavioralOverride: string | null };

async function resolveEntity(id: number, typeHint?: string): Promise<ResolvedEntity | null> {
  if (typeHint === "coaching_client") {
    const [row] = await db
      .select({ behavioralOverride: coachingClientsTable.behavioralOverride })
      .from(coachingClientsTable)
      .where(eq(coachingClientsTable.id, id));
    return row ? { kind: "coaching_client", behavioralOverride: row.behavioralOverride ?? null } : null;
  }
  if (typeHint === "player") {
    const [row] = await db
      .select({ behavioralOverride: usersTable.behavioralOverride })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    return row ? { kind: "user", behavioralOverride: row.behavioralOverride ?? null } : null;
  }
  const [userRow] = await db
    .select({ behavioralOverride: usersTable.behavioralOverride })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (userRow) return { kind: "user", behavioralOverride: userRow.behavioralOverride ?? null };
  const [clientRow] = await db
    .select({ behavioralOverride: coachingClientsTable.behavioralOverride })
    .from(coachingClientsTable)
    .where(eq(coachingClientsTable.id, id));
  return clientRow ? { kind: "coaching_client", behavioralOverride: clientRow.behavioralOverride ?? null } : null;
}

async function writePgOverride(entity: ResolvedEntity, id: number, newOverride: string): Promise<void> {
  if (entity.kind === "user") {
    await db.update(usersTable).set({ behavioralOverride: newOverride }).where(eq(usersTable.id, id));
  } else {
    await db.update(coachingClientsTable).set({ behavioralOverride: newOverride }).where(eq(coachingClientsTable.id, id));
  }
}

router.get("/players/:id/profile", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid player id" }); return; }

  const typeHint = typeof req.query.type === "string" ? req.query.type : undefined;
  const entity = await resolveEntity(id, typeHint);
  const pgOverride = parsePgOverride(entity?.behavioralOverride);
  const hasPgOverride = !!(pgOverride.behavioralFlags?.length || pgOverride.reliabilityScore !== undefined);

  const pgOnlyProfile = {
    userId: id,
    reliabilityScore: pgOverride.reliabilityScore ?? 75,
    noShowCount: 0,
    sessionStreak: 0,
    behavioralFlags: pgOverride.behavioralFlags ?? [] as string[],
    last30MatchIds: [] as number[],
    source: hasPgOverride ? "pg-override" : "default",
  };

  if (entity?.kind === "coaching_client") {
    res.json(pgOnlyProfile);
    return;
  }

  const profile = await getOrCreateProfile(id);
  if (!profile) {
    res.json(pgOnlyProfile);
    return;
  }

  const mergedFlags = [
    ...profile.behavioralFlags,
    ...(pgOverride.behavioralFlags ?? []).filter(f => !profile.behavioralFlags.includes(f)),
  ];
  const scoreIsOverridden = pgOverride.reliabilityScore !== undefined;
  const flagsAreOverridden = (pgOverride.behavioralFlags?.length ?? 0) > 0;

  res.json({
    userId: profile.userId,
    reliabilityScore: scoreIsOverridden ? pgOverride.reliabilityScore! : profile.reliabilityScore,
    noShowCount: profile.noShowCount,
    sessionStreak: profile.sessionStreak,
    behavioralFlags: mergedFlags,
    last30MatchIds: profile.last30MatchIds,
    updatedAt: profile.updatedAt,
    source: scoreIsOverridden || flagsAreOverridden ? "postgres+pg-override" : "postgres",
  });
});

router.patch("/players/:id/profile/flags", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = verifyToken(token);
  if (!payload || !["coach", "admin", "owner"].includes(payload.role)) {
    res.status(403).json({ error: "Forbidden — coach or admin required" });
    return;
  }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid player id" }); return; }

  const PatchFlagsBody = z.object({
    type: z.enum(["coaching_client", "player"]).optional(),
    addFlags: z.array(z.string().min(1).max(100)).max(20).optional(),
    removeFlags: z.array(z.string().min(1).max(100)).max(20).optional(),
    reliabilityScore: z.number().min(0).max(100).optional(),
  });

  const parsed = PatchFlagsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { addFlags, removeFlags, reliabilityScore, type: typeHint } = parsed.data;

  const entity = await resolveEntity(id, typeHint);
  if (!entity) { res.status(404).json({ error: "Player not found" }); return; }

  let responsePayload: {
    userId: number;
    reliabilityScore: number;
    noShowCount: number;
    sessionStreak: number;
    behavioralFlags: string[];
    updatedAt: Date;
    source: string;
  };

  const pgUpdated = entity.kind === "coaching_client"
    ? null
    : await patchPlayerProfile(id, { addFlags, removeFlags, reliabilityScore });

  if (pgUpdated) {
    responsePayload = {
      userId: pgUpdated.userId,
      reliabilityScore: pgUpdated.reliabilityScore,
      noShowCount: pgUpdated.noShowCount,
      sessionStreak: pgUpdated.sessionStreak,
      behavioralFlags: pgUpdated.behavioralFlags,
      updatedAt: pgUpdated.updatedAt,
      source: "postgres",
    };
  } else {
    const pgOverride = parsePgOverride(entity.behavioralOverride);
    let flags = [...(pgOverride.behavioralFlags ?? [])];
    if (addFlags) {
      for (const f of addFlags) { if (!flags.includes(f)) flags.push(f); }
    }
    if (removeFlags) {
      flags = flags.filter(f => !removeFlags.includes(f));
    }
    const newScore = reliabilityScore !== undefined
      ? Math.max(0, Math.min(100, reliabilityScore))
      : (pgOverride.reliabilityScore ?? 75);

    await writePgOverride(entity, id, JSON.stringify({ reliabilityScore: newScore, behavioralFlags: flags }));

    responsePayload = {
      userId: id,
      reliabilityScore: newScore,
      noShowCount: 0,
      sessionStreak: 0,
      behavioralFlags: flags,
      updatedAt: new Date(),
      source: "pg-override",
    };
  }

  await db.insert(activityLogsTable).values({
    userId: payload.userId,
    userName: "Coach",
    action: "profile_flags_updated",
    details: `Player ${id} (${entity.kind}): flags=${JSON.stringify(responsePayload.behavioralFlags)}, score=${responsePayload.reliabilityScore}`,
  });

  res.json(responsePayload);
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

  res.json({ score: score.score, factors: score.factors, computedAt: score.computedAt, source: "postgres" });
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
    ...(parsed.data.reminderOptOut !== undefined && { reminderOptOut: parsed.data.reminderOptOut }),
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
