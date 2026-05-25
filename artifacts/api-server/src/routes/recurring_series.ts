import { Router, type IRouter } from "express";
import { db, recurringSeriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";
import { runGroupTrainingTick } from "../lib/groupTrainingScheduler";
import { fireAndForget } from "../lib/fireAndForget";

const router: IRouter = Router();
router.use(requireAuth);

const UuidSchema = z.string().uuid();
const CATEGORIES = ["D-", "D", "D+", "C-", "C", "C+", "B-"] as const;

function isCoachRole(role: string): boolean {
  return ["coach", "admin", "owner"].includes(role);
}
function isAdminRole(role: string): boolean {
  return ["admin", "owner"].includes(role);
}

const CreateBody = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  category: z.enum(CATEGORIES),
  courtName: z.string().min(1),
  courtAddress: z.string().optional().nullable(),
  maxParticipants: z.number().int().min(2).max(8).optional(),
  priceAed: z.union([z.string(), z.number()]),
  descriptionEn: z.string().optional().nullable(),
  descriptionRu: z.string().optional().nullable(),
  untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  active: z.boolean().optional(),
});
const UpdateBody = CreateBody.partial();

function serialize(s: typeof recurringSeriesTable.$inferSelect) {
  return {
    id: s.id,
    coachId: s.coachId,
    weekday: s.weekday,
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    category: s.category,
    courtName: s.courtName,
    courtAddress: s.courtAddress ?? null,
    maxParticipants: s.maxParticipants,
    priceAed: String(s.priceAed),
    descriptionEn: s.descriptionEn ?? null,
    descriptionRu: s.descriptionRu ?? null,
    active: s.active,
    untilDate: s.untilDate ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/recurring-series", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const conds = isAdminRole(role) ? [] : [eq(recurringSeriesTable.coachId, authUserId)];
  const rows = await db
    .select()
    .from(recurringSeriesTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(recurringSeriesTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/recurring-series", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const b = parsed.data;
  const [row] = await db
    .insert(recurringSeriesTable)
    .values({
      coachId: authUserId,
      weekday: b.weekday,
      startTime: b.startTime,
      durationMinutes: b.durationMinutes ?? 90,
      category: b.category,
      courtName: b.courtName,
      courtAddress: b.courtAddress ?? null,
      maxParticipants: b.maxParticipants ?? 4,
      priceAed: String(b.priceAed),
      descriptionEn: b.descriptionEn ?? null,
      descriptionRu: b.descriptionRu ?? null,
      active: b.active ?? true,
      untilDate: b.untilDate ?? null,
    })
    .returning();
  // Eagerly generate instances so coach sees them immediately.
  fireAndForget(runGroupTrainingTick(), { kind: "recurring_series_created_tick" });
  res.status(201).json(serialize(row));
});

router.patch("/recurring-series/:id", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const idParsed = UuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }
  const [existing] = await db
    .select()
    .from(recurringSeriesTable)
    .where(eq(recurringSeriesTable.id, idParsed.data));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!isAdminRole(role) && existing.coachId !== authUserId) {
    res.status(403).json({ error: "Not your series" });
    return;
  }
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const b = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    update[k] = k === "priceAed" ? String(v) : v;
  }
  const [row] = await db
    .update(recurringSeriesTable)
    .set(update)
    .where(eq(recurringSeriesTable.id, idParsed.data))
    .returning();
  fireAndForget(runGroupTrainingTick(), { kind: "recurring_series_updated_tick" });
  res.json(serialize(row));
});

router.delete("/recurring-series/:id", async (req, res): Promise<void> => {
  const role: string = (req as any).auth.role;
  const authUserId: number = (req as any).auth.userId;
  if (!isCoachRole(role)) {
    res.status(403).json({ error: "Coach or admin only" });
    return;
  }
  const idParsed = UuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }
  const [existing] = await db
    .select()
    .from(recurringSeriesTable)
    .where(eq(recurringSeriesTable.id, idParsed.data));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!isAdminRole(role) && existing.coachId !== authUserId) {
    res.status(403).json({ error: "Not your series" });
    return;
  }
  // Soft-deactivate (existing future instances remain bookable).
  const [row] = await db
    .update(recurringSeriesTable)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(recurringSeriesTable.id, idParsed.data))
    .returning();
  res.json(serialize(row));
});

export default router;
