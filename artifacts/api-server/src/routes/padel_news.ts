import { Router, type IRouter } from "express";
import { db, padelNewsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireMode } from "../middleware/auth";

const requireAdminMode = requireMode("admin", "developer");

const router: IRouter = Router();

router.get("/padel-news", requireAuth, async (_req, res): Promise<void> => {
  const news = await db.select().from(padelNewsTable)
    .where(eq(padelNewsTable.published, true))
    .orderBy(desc(padelNewsTable.createdAt));
  res.json(news);
});

router.post("/padel-news", requireAdminMode, async (req, res): Promise<void> => {
  const { title, content, category, author, imageUrl } = req.body;
  const [item] = await db.insert(padelNewsTable).values({
    title, content, category: category ?? "coaching_tip",
    author: author ?? "Misha", imageUrl, published: true,
  }).returning();
  res.status(201).json(item);
});

export default router;
