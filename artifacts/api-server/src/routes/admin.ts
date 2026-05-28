import { Router, type IRouter } from "express";
import { db, usersTable, activityLogsTable, reminderLogsTable } from "@workspace/db";
import { and, eq, ne, isNull, desc, inArray } from "drizzle-orm";
import { getTokenFromRequest, verifyToken } from "../lib/auth";
import { formatUser } from "./auth";
import { sendReminderToUser, getReminderEligibility, REMINDER_MAX_TOTAL, REMINDER_COOLDOWN_HOURS } from "../lib/reminderJob";
import { hashPassword } from "../lib/auth";
import { sendInviteEmail } from "../lib/mail";
import { generateInviteToken } from "./invite";
import crypto from "crypto";

const router: IRouter = Router();

const MIKE_EMAIL = "mikebelokur8@gmail.com";

async function requireOwnerOrAdmin(req: any, res: any): Promise<{ userId: number; role: string } | null> {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const [u] = await db
    .select({ modeAdmin: usersTable.modeAdmin, modeDeveloper: usersTable.modeDeveloper })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  if (!u || !(u.modeAdmin || u.modeDeveloper)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return payload;
}

// Extended guard for GET /admin/users: admin/developer modes OR Mike (read-only segmentation)
async function requireAdminUserListAccess(req: any, res: any): Promise<{ userId: number; role: string } | null> {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const [u] = await db
    .select({
      email: usersTable.email,
      modeAdmin: usersTable.modeAdmin,
      modeDeveloper: usersTable.modeDeveloper,
    })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  if (u && (u.modeAdmin || u.modeDeveloper)) return payload;
  if (u?.email === MIKE_EMAIL) return payload;
  res.status(403).json({ error: "Forbidden" });
  return null;
}

// GET /api/admin/users — all users with optional ?userType= filter
router.get("/admin/users", async (req, res): Promise<void> => {
  if (!await requireAdminUserListAccess(req, res)) return;

  const { userType } = req.query;
  const validTypes = ["real_user", "seed_test", "beta_tester"];

  let rows = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  if (typeof userType === "string" && validTypes.includes(userType)) {
    rows = rows.filter(u => (u.userType ?? "real_user") === userType);
  }
  res.json(rows.map(formatUser));
});

// PUT /api/admin/users/:id/level — set skill level
router.put("/admin/users/:id/level", async (req, res): Promise<void> => {
  if (!await requireOwnerOrAdmin(req, res)) return;
  const id = parseInt(req.params.id);
  const { level } = req.body;
  if (!level) { res.status(400).json({ error: "Level is required" }); return; }

  const [user] = await db.update(usersTable)
    .set({ level, verified: true, verificationDate: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(activityLogsTable).values({
    userId: id,
    userName: user.name,
    action: "level_updated",
    details: `Level manually set to ${level} by admin`,
    detailsParams: { level },
  });

  res.json(formatUser(user));
});

// DELETE /api/admin/users/:id — delete user
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;

  const id = parseInt(req.params.id);
  if (id === auth.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "User not found" }); return; }

  res.json({ message: "User deleted" });
});

// PATCH /api/admin/users/:id/user-type — set user type
router.patch("/admin/users/:id/user-type", async (req, res): Promise<void> => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;

  const id = parseInt(req.params.id);
  const { userType } = req.body;
  const validTypes = ["real_user", "seed_test", "beta_tester"];
  if (!userType || !validTypes.includes(userType)) {
    res.status(400).json({ error: "Invalid userType" });
    return;
  }

  const [user] = await db.update(usersTable)
    .set({ userType })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(activityLogsTable).values({
    userId: id,
    userName: user.name,
    action: "user_type_changed",
    details: `User type set to ${userType} by admin`,
    detailsParams: { userType },
  });

  res.json(formatUser(user));
});

// GET /api/admin/incomplete-profiles — players (role='player') with archetype IS NULL
router.get("/admin/incomplete-profiles", async (req, res): Promise<void> => {
  if (!await requireOwnerOrAdmin(req, res)) return;

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      createdAt: usersTable.createdAt,
      reminderSentAt: usersTable.reminderSentAt,
      reminderOptOut: usersTable.reminderOptOut,
    })
    .from(usersTable)
    .where(and(isNull(usersTable.archetype), eq(usersTable.role, "player")))
    .orderBy(usersTable.createdAt);

  const userIds = rows.map(r => r.id);
  const logs = userIds.length === 0
    ? []
    : await db
        .select({
          id: reminderLogsTable.id,
          userId: reminderLogsTable.userId,
          sentAt: reminderLogsTable.sentAt,
          triggeredBy: reminderLogsTable.triggeredBy,
          senderUserId: reminderLogsTable.senderUserId,
          delivered: reminderLogsTable.delivered,
        })
        .from(reminderLogsTable)
        .where(inArray(reminderLogsTable.userId, userIds))
        .orderBy(desc(reminderLogsTable.sentAt));

  const senderIds = Array.from(new Set(logs.map(l => l.senderUserId).filter((v): v is number => v != null)));
  const senders = senderIds.length === 0
    ? []
    : await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, senderIds));
  const senderNameById = new Map(senders.map(s => [s.id, s.name]));

  const logsByUser = new Map<number, Array<{ id: number; sentAt: string; triggeredBy: string; senderUserId: number | null; senderName: string | null; delivered: boolean }>>();
  for (const l of logs) {
    const list = logsByUser.get(l.userId) ?? [];
    list.push({
      id: l.id,
      sentAt: l.sentAt.toISOString(),
      triggeredBy: l.triggeredBy,
      senderUserId: l.senderUserId,
      senderName: l.senderUserId != null ? senderNameById.get(l.senderUserId) ?? null : null,
      delivered: l.delivered,
    });
    logsByUser.set(l.userId, list);
  }

  res.json(rows.map(u => {
    const history = logsByUser.get(u.id) ?? [];
    const eligibility = getReminderEligibility(u.reminderSentAt, history.length);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      reminderSentAt: u.reminderSentAt?.toISOString() ?? null,
      reminderOptOut: u.reminderOptOut,
      reminderCount: history.length,
      reminderHistory: history,
      canRemind: eligibility.canSend && !u.reminderOptOut,
      remindBlockedReason: u.reminderOptOut ? "opted_out" : (eligibility.canSend ? null : eligibility.reason),
      nextReminderAllowedAt: eligibility.canSend ? null : eligibility.nextAllowedAt?.toISOString() ?? null,
      remindersRemaining: eligibility.remaining,
      reminderMaxTotal: REMINDER_MAX_TOTAL,
      reminderCooldownHours: REMINDER_COOLDOWN_HOURS,
    };
  }));
});

// POST /api/admin/incomplete-profiles/:id/remind — manually send reminder
router.post("/admin/incomplete-profiles/:id/remind", async (req, res): Promise<void> => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

  try {
    const result = await sendReminderToUser(id, auth.userId);
    if (result.alreadyDone) {
      res.status(400).json({ error: "Player has already completed their profile" });
      return;
    }
    if (result.blocked) {
      const errorMsg = result.blocked.reason === "max_reached"
        ? "Достигнут лимит напоминаний для этого игрока"
        : "Слишком рано для повторного напоминания";
      res.status(429).json({
        error: errorMsg,
        reason: result.blocked.reason,
        nextAllowedAt: result.blocked.nextAllowedAt,
        remaining: result.blocked.remaining,
      });
      return;
    }
    res.json({ sent: result.sent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(404).json({ error: message });
  }
});

// POST /api/admin/incomplete-profiles/remind-all — bulk send reminders
router.post("/admin/incomplete-profiles/remind-all", async (req, res): Promise<void> => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;

  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      isNull(usersTable.archetype),
      eq(usersTable.role, "player"),
      eq(usersTable.reminderOptOut, false),
    ));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cooldown = 0;
  let capped = 0;

  for (const u of rows) {
    try {
      const result = await sendReminderToUser(u.id, auth.userId);
      if (result.alreadyDone) skipped++;
      else if (result.blocked) {
        if (result.blocked.reason === "cooldown") cooldown++;
        else capped++;
      }
      else if (result.sent) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  res.json({ total: rows.length, sent, failed, skipped, cooldown, capped });
});

// POST /api/admin/users — coach/admin creates a new user and sends invite email
router.post("/admin/users", async (req, res): Promise<void> => {
  const auth = await requireOwnerOrAdmin(req, res);
  if (!auth) return;

  const { name, email, phone, level, role } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    phone?: string;
    level?: string;
    role?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const validRoles = ["player", "coach", "admin"];
  const finalRole = role && validRoles.includes(role) ? role : "player";

  // Placeholder password (high-entropy, never used — user sets real one via invite)
  const placeholder = crypto.randomBytes(32).toString("hex");
  const { token: inviteToken, expiresAt } = generateInviteToken();

  const [user] = await db
    .insert(usersTable)
    .values({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ?? "",
      passwordHash: hashPassword(placeholder),
      level: level ?? "D",
      role: finalRole,
      source: "coach_added",
      inviteStatus: "invited",
      inviteToken,
      inviteTokenExpiresAt: expiresAt,
      approvalStatus: "approved",
    })
    .returning();

  await db.insert(activityLogsTable).values({
    userId: user.id,
    userName: user.name,
    action: "user_invited",
    details: `Invited by ${auth.role} ${auth.userId} as ${finalRole}`,
    detailsParams: { role: finalRole, invitedBy: auth.role, invitedById: auth.userId },
  });

  const appUrl = process.env.APP_URL
    ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "http://localhost:80");
  const inviteUrl = `${appUrl}/invite/${inviteToken}`;
  const mailResult = await sendInviteEmail(user.email, user.name, inviteUrl);

  res.status(201).json({
    user: formatUser(user),
    inviteUrl,
    emailSent: mailResult.sent,
    devInviteUrl: !mailResult.sent ? inviteUrl : undefined,
  });
});

// PUT /api/admin/users/:id/role — set role
router.put("/admin/users/:id/role", async (req, res): Promise<void> => {
  if (!await requireOwnerOrAdmin(req, res)) return;
  const id = parseInt(req.params.id);
  const { role } = req.body;
  const validRoles = ["player", "coach", "admin", "owner"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const [user] = await db.update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

export default router;
