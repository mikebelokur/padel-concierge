import { Router, type IRouter } from "express";
import { db, usersTable, activityLogsTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { hashPassword, verifyPassword, generateToken, getTokenFromRequest, verifyToken } from "../lib/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { sendPasswordResetEmail } from "../lib/mail";

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
    archetype: user.archetype ?? null,
    warmUpPreference: user.warmUpPreference,
    levelSelf: user.levelSelf ?? null,
    levelQuiz: user.levelQuiz ?? null,
    physicalSelf: user.physicalSelf ?? null,
    warmupFormat: user.warmupFormat ?? null,
    userType: user.userType ?? "real_user",
    reminderOptOut: user.reminderOptOut,
    notifyEmailTrainerRequests: user.notifyEmailTrainerRequests,
    notifyWhatsappTrainerRequests: user.notifyWhatsappTrainerRequests,
    source: user.source ?? "self_signup",
    memberNumber: user.memberNumber,
    badge: user.badge ?? null,
    inviteStatus: user.inviteStatus ?? "not_invited",
    coachingClientId: user.coachingClientId ?? null,
    modePlayer: user.modePlayer ?? true,
    modeCoach: user.modeCoach ?? false,
    modeAdmin: user.modeAdmin ?? false,
    modeDeveloper: user.modeDeveloper ?? false,
  };
}

const checkEmailHits = new Map<string, { count: number; resetAt: number }>();
const CHECK_EMAIL_WINDOW_MS = 60_000;
const CHECK_EMAIL_MAX = 20;

router.get("/auth/check-email", async (req, res): Promise<void> => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").toString();
  const now = Date.now();
  const entry = checkEmailHits.get(ip);
  if (!entry || entry.resetAt < now) {
    checkEmailHits.set(ip, { count: 1, resetAt: now + CHECK_EMAIL_WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > CHECK_EMAIL_MAX) {
      res.status(429).json({ available: true });
      return;
    }
  }
  if (checkEmailHits.size > 5000) {
    for (const [k, v] of checkEmailHits) if (v.resetAt < now) checkEmailHits.delete(k);
  }

  const emailRaw = (req.query.email as string | undefined) ?? "";
  const email = emailRaw.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.json({ available: true });
    return;
  }
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  res.json({ available: existing.length === 0 });
});

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
    approvalStatus: "pending",
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
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  // Super admin bypass
  const superAdminCode = process.env.SUPER_ADMIN_CODE;
  if (email === "admin" && superAdminCode && password === superAdminCode) {
    const ownerEmail = "misha.belokur@gmail.com";
    let [owner] = await db.select().from(usersTable).where(eq(usersTable.email, ownerEmail));
    if (!owner) {
      [owner] = await db.insert(usersTable).values({
        name: "Misha (Owner)",
        email: ownerEmail,
        phone: "",
        passwordHash: hashPassword("Padel2024!"),
        level: "5.0",
        goal: "Compete",
        intensity: "Professional",
        role: "owner",
        verified: true,
        verificationDate: new Date(),
        isOnline: true,
        lastActive: new Date(),
        lastLogin: new Date(),
      }).returning();
    } else {
      await db.update(usersTable).set({ lastLogin: new Date(), isOnline: true, lastActive: new Date() }).where(eq(usersTable.id, owner.id));
    }
    const token = generateToken(owner.id, "owner");
    res.json({ token, user: formatUser({ ...owner, lastLogin: new Date(), isOnline: true, role: "owner" }) });
    return;
  }

  const parsed = LoginBody.safeParse({ email, password });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  // Always respond 200 to avoid email enumeration
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    // Delete any existing tokens for this user
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

    const appUrl = process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = appUrl ? `https://${appUrl}` : "http://localhost:80";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const result = await sendPasswordResetEmail(user.email, resetUrl);
    if (!result.sent && result.devUrl) {
      // Dev mode — return URL in response so the browser can display it
      res.json({ message: "If that email exists, a reset link has been sent.", devResetUrl: result.devUrl });
      return;
    }
  }

  res.json({ message: "If that email exists, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};
  if (!token || !password) { res.status(400).json({ error: "Token and password are required" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

  const [resetToken] = await db.select()
    .from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.token, token),
      gt(passwordResetTokensTable.expiresAt, new Date())
    ));

  if (!resetToken) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = hashPassword(password);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, resetToken.userId));
  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, resetToken.id));

  res.json({ message: "Password updated successfully" });
});

export { formatUser };
export default router;
