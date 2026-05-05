import { Router, type IRouter } from "express";
import { db, usersTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateUserBody, UpdateAvailabilityBody, AddFavouriteBody, RemoveFavouriteBody } from "@workspace/api-zod";
import { formatUser } from "./auth";

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
  };

  const candidates: Candidate[] = [];
  for (const u of others) {
    const uLvl = levelIdx(u.level);
    const skillDiff = Math.abs(myLvl - uLvl);
    const archetypeMatch = !!(me.archetype && u.archetype && me.archetype === u.archetype);

    if (archetypeMatch && skillDiff <= 2) {
      candidates.push({ user: u, skillDiff, archetypeMatch, priority: 1 });
    } else if (skillDiff <= 3) {
      candidates.push({ user: u, skillDiff, archetypeMatch, priority: 2 });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || a.skillDiff - b.skillDiff);
  const top3 = candidates.slice(0, 3);

  res.json({
    matches: top3.map(c => ({
      ...formatUser(c.user),
      skillDiff: c.skillDiff,
      archetypeMatch: c.archetypeMatch,
      priority: c.priority,
    })),
    noMatchesMessage: top3.length === 0
      ? "Подходящих игроков пока нет. Попробуй позже или расширь время доступности."
      : null,
  });
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
