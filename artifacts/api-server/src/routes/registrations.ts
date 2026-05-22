import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ne, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

router.get("/admin/registrations", requireAdmin, async (_req, res): Promise<void> => {
  const pending = await db.select().from(usersTable)
    .where(ne(usersTable.approvalStatus, "approved"))
    .orderBy(desc(usersTable.createdAt));
  res.json(pending);
});

router.get("/admin/registrations/count", requireAdmin, async (_req, res): Promise<void> => {
  const pending = await db.select().from(usersTable)
    .where(eq(usersTable.approvalStatus, "pending"));
  res.json({ count: pending.length });
});

router.put("/admin/registrations/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(usersTable)
    .set({
      approvalStatus: "approved",
      approvedAt: new Date(),
      approvedBy: "misha.belokur@gmail.com",
    })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(updated);
});

router.put("/admin/registrations/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(usersTable)
    .set({ approvalStatus: "rejected" })
    .where(eq(usersTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/admin/registrations/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(usersTable).where(eq(usersTable.id, parseInt(req.params.id)));
  res.json({ message: "Deleted" });
});

export default router;
