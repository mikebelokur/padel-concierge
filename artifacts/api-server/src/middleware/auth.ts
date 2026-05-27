import { Request, Response, NextFunction } from "express";
import { getTokenFromRequest, verifyToken } from "../lib/auth";
import { pool, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type Mode = "player" | "coach" | "admin" | "developer";

export function requireMode(...modes: Mode[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = getTokenFromRequest(req);
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = verifyToken(token);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
      const [user] = await db
        .select({
          modePlayer: usersTable.modePlayer,
          modeCoach: usersTable.modeCoach,
          modeAdmin: usersTable.modeAdmin,
          modeDeveloper: usersTable.modeDeveloper,
        })
        .from(usersTable)
        .where(eq(usersTable.id, payload.userId));
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const hasAny = modes.some((m) => {
        if (m === "player") return user.modePlayer;
        if (m === "coach") return user.modeCoach;
        if (m === "admin") return user.modeAdmin;
        if (m === "developer") return user.modeDeveloper;
        return false;
      });
      if (!hasAny) { res.status(403).json({ error: "Forbidden" }); return; }

      (req as any).auth = { ...payload, modes: user };
      next();
    } catch {
      res.status(500).json({ error: "Internal error" });
    }
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as any).auth = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!["admin", "owner"].includes(payload.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).auth = payload;
  next();
}

export async function requireAdminOrCoach(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (["admin", "owner", "coach"].includes(payload.role)) {
    (req as any).auth = payload;
    next();
    return;
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    try {
      const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [payload.userId]);
      if (rows.length && adminEmails.includes(rows[0].email.toLowerCase())) {
        (req as any).auth = { ...payload, role: "admin" };
        next();
        return;
      }
    } catch {
      // fall through to Forbidden
    }
  }

  res.status(403).json({ error: "Forbidden" });
}
