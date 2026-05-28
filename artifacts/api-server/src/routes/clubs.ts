import { Router, type IRouter } from "express";
import { db, clubsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getTokenFromRequest, verifyToken } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth);

type ClubRow = typeof clubsTable.$inferSelect;

function parseClub(c: ClubRow) {
  return {
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl ?? null,
    photoUrl: c.photoUrl ?? null,
    address: c.address,
    area: c.area,
    phone: c.phone ?? null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    tier: c.tier,
    website: c.website ?? null,
    openingHours: c.openingHours ?? null,
    notes: c.notes ?? null,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
  };
}

function isAdminLike(req: import("express").Request): boolean {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  return payload?.role === "admin" || payload?.role === "coach";
}

router.get("/clubs", async (req, res): Promise<void> => {
  const includeInactive = String(req.query.includeInactive ?? "false") === "true";
  const rows = await db.select().from(clubsTable).orderBy(clubsTable.name);
  const filtered = includeInactive ? rows : rows.filter((r) => r.active);
  res.json(filtered.map(parseClub));
});

router.get("/clubs/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid club id" });
    return;
  }
  const [row] = await db.select().from(clubsTable).where(eq(clubsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  res.json(parseClub(row));
});

router.post("/clubs", async (req, res): Promise<void> => {
  if (!isAdminLike(req)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const b = req.body ?? {};
  if (!b.name || !b.address || !b.area) {
    res.status(400).json({ error: "name, address, area required" });
    return;
  }
  const [row] = await db.insert(clubsTable).values({
    name: String(b.name),
    address: String(b.address),
    area: String(b.area),
    logoUrl: b.logoUrl ?? null,
    photoUrl: b.photoUrl ?? null,
    phone: b.phone ?? null,
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    tier: b.tier ?? "standard",
    website: b.website ?? null,
    openingHours: b.openingHours ?? null,
    notes: b.notes ?? null,
    active: b.active ?? true,
  }).returning();
  res.status(201).json(parseClub(row));
});

router.patch("/clubs/:id", async (req, res): Promise<void> => {
  if (!isAdminLike(req)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid club id" });
    return;
  }
  const b = req.body ?? {};
  const updates: Partial<typeof clubsTable.$inferInsert> = {};
  for (const k of ["name","address","area","logoUrl","photoUrl","phone","tier","website","notes"] as const) {
    if (k in b) updates[k] = b[k];
  }
  if ("lat" in b) updates.lat = b.lat ?? null;
  if ("lng" in b) updates.lng = b.lng ?? null;
  if ("openingHours" in b) updates.openingHours = b.openingHours ?? null;
  if ("active" in b) updates.active = !!b.active;

  const [row] = await db.update(clubsTable).set(updates).where(eq(clubsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Club not found" }); return; }
  res.json(parseClub(row));
});

router.delete("/clubs/:id", async (req, res): Promise<void> => {
  if (!isAdminLike(req)) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid club id" });
    return;
  }
  const [row] = await db.delete(clubsTable).where(eq(clubsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Club not found" }); return; }
  res.json({ ok: true });
});

export default router;
