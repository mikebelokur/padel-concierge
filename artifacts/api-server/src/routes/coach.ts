import { Router, type IRouter } from "express";
import { db, usersTable, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatUser } from "./auth";
import { formatMatch } from "./matches";

const router: IRouter = Router();

router.get("/coach/players", async (_req, res): Promise<void> => {
  const players = await db.select().from(usersTable)
    .where(eq(usersTable.role, "player"))
    .orderBy(usersTable.createdAt);
  res.json(players.map(formatUser));
});

router.get("/coach/upcoming-matches", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const matches = await db.select().from(matchesTable)
    .orderBy(matchesTable.date);

  const upcoming = matches.filter(m =>
    m.date >= today && (m.status === "suggested" || m.status === "confirmed")
  );

  res.json(upcoming.map(formatMatch));
});

export default router;
