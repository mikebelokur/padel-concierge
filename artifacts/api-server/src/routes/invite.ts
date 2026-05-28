import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, usersTable, activityLogsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { hashPassword, generateToken } from "../lib/auth";
import { formatUser } from "./auth";

const router: IRouter = Router();

// invite_token column is uuid — reject malformed values up front so we never
// hit a Postgres cast error / 500 from a stray request.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/invite/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token || !UUID_RE.test(token)) {
    res.status(404).json({ error: "Invalid or expired invite" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.inviteToken, token),
        eq(usersTable.inviteStatus, "invited"),
        gt(usersTable.inviteTokenExpiresAt, new Date()),
      ),
    );
  if (!user) {
    res.status(404).json({ error: "Invalid or expired invite" });
    return;
  }
  res.json({
    name: user.name,
    email: user.email,
    memberNumber: user.memberNumber,
    badge: user.badge ?? null,
    inviteStatus: user.inviteStatus,
    expiresAt: user.inviteTokenExpiresAt?.toISOString() ?? null,
  });
});

router.post("/invite/:token/accept", async (req, res): Promise<void> => {
  const token = req.params.token;
  const { password } = (req.body ?? {}) as { password?: string };
  if (!token || !UUID_RE.test(token)) {
    res.status(404).json({ error: "Invalid or expired invite" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.inviteToken, token),
        eq(usersTable.inviteStatus, "invited"),
        gt(usersTable.inviteTokenExpiresAt, new Date()),
      ),
    );
  if (!user) {
    res.status(404).json({ error: "Invalid or expired invite" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash,
      inviteStatus: "activated",
      inviteToken: null,
      inviteTokenExpiresAt: null,
      lastLogin: new Date(),
      isOnline: true,
      lastActive: new Date(),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  await db.insert(activityLogsTable).values({
    userId: user.id,
    userName: user.name,
    action: "invite_accepted",
    details: `Invited member #${user.memberNumber} activated account`,
    detailsParams: { memberNumber: user.memberNumber },
  });

  const authToken = generateToken(updated.id, updated.role);
  res.json({ token: authToken, user: formatUser(updated) });
});

export default router;
export { router as inviteRouter };

/** Build a fresh invite token for an existing user (used by admin create). */
export function generateInviteToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return { token, expiresAt };
}
