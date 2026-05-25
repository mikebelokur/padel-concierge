import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

const UuidSchema = z.string().uuid();

router.get("/notifications", async (req, res): Promise<void> => {
  const userId: number = (req as any).auth.userId;
  const unreadOnly = req.query["unread"] === "true";

  const conds = [eq(notificationsTable.userId, userId)];
  if (unreadOnly) conds.push(isNull(notificationsTable.readAt));

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(...conds))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(
    rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      trainingId: n.trainingId ?? null,
      titleEn: n.titleEn,
      titleRu: n.titleRu,
      bodyEn: n.bodyEn,
      bodyRu: n.bodyRu,
      link: n.link ?? null,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
  );
});

router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const userId: number = (req as any).auth.userId;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    );
  res.json({ count: Number(row?.count ?? 0) });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const userId: number = (req as any).auth.userId;
  const parsed = UuidSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id (uuid expected)" });
    return;
  }
  const [row] = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.id, parsed.data),
        eq(notificationsTable.userId, userId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ id: row.id, readAt: row.readAt?.toISOString() ?? null });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const userId: number = (req as any).auth.userId;
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
      ),
    );
  res.json({ ok: true });
});

export default router;
