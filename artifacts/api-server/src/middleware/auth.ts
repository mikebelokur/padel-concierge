import { Request, Response, NextFunction } from "express";
import { getTokenFromRequest, verifyToken } from "../lib/auth";

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
