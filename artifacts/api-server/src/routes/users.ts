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
