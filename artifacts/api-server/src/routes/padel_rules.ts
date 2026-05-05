import { Router, type IRouter } from "express";
import { db, padelRulesTable } from "@workspace/db";
import { ilike, or } from "drizzle-orm";

const router: IRouter = Router();

router.get("/padel-rules", async (req, res): Promise<void> => {
  const q = (req.query.q as string) ?? "";
  const rules = q
    ? await db.select().from(padelRulesTable).where(
        or(
          ilike(padelRulesTable.titleEn, `%${q}%`),
          ilike(padelRulesTable.ruleEn, `%${q}%`),
          ilike(padelRulesTable.ruleRu, `%${q}%`),
          ilike(padelRulesTable.titleRu, `%${q}%`)
        )
      )
    : await db.select().from(padelRulesTable).orderBy(padelRulesTable.sortOrder);
  res.json(rules);
});

export default router;
