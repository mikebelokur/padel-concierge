import { Router, type IRouter } from "express";
import { db, usersTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken, getTokenFromRequest, verifyToken } from "../lib/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    level: user.level,
    goal: user.goal,
    intensity: user.intensity,
    locationLat: user.locationLat ?? null,
    locationLng: user.locationLng ?? null,
    locationName: user.locationName ?? null,
    avatar: user.avatar ?? null,
    verified: user.verified,
    verificationDate: user.verificationDate?.toISOString() ?? null,
    role: user.role,
    favouritePlayers: (user.favouritePlayers ?? []).map(Number),
    availability: JSON.parse(user.availability ?? "[]"),
    matchesPlayed: user.matchesPlayed,
    wins: user.wins,
    language: user.language,
    isOnline: user.isOnline,
    lastActive: user.lastActive?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() ?? null,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, phone, password, level, goal, intensity, locationLat, locationLng, locationName, role } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    phone,
    passwordHash,
    level,
    goal,
    intensity,
    locationLat: locationLat ?? null,
    locationLng: locationLng ?? null,
    locationName: locationName ?? null,
    role: role ?? "player",
    lastLogin: new Date(),
    isOnline: true,
    lastActive: new Date(),
  }).returning();

  await db.insert(activityLogsTable).values({
    userId: user.id,
    userName: user.name,
    action: "registered",
    details: `New ${user.role} registered`,
  });

  const token = generateToken(user.id, user.role);
  res.status(201).json({ token, user: formatUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db.update(usersTable).set({ lastLogin: new Date(), isOnline: true, lastActive: new Date() }).where(eq(usersTable.id, user.id));
  await db.insert(activityLogsTable).values({ userId: user.id, userName: user.name, action: "logged_in", details: null });

  const token = generateToken(user.id, user.role);
  res.json({ token, user: formatUser({ ...user, lastLogin: new Date(), isOnline: true }) });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid token" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json(formatUser(user));
});

export { formatUser };
export default router;
