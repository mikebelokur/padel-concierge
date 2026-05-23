import { Request, Response, NextFunction } from "express";
import { getTokenFromRequest, verifyToken } from "../lib/auth";
import { pool } from "@workspace/db";

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
