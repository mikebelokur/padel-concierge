import { Router, type IRouter } from "express";
import { db, skillAssessmentsTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const WPT_LEVELS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

function computeLevel(score: number): string {
  if (score <= 4) return "1.0";
  if (score <= 8) return "1.5";
  if (score <= 12) return "2.0";
  if (score <= 16) return "2.5";
  if (score <= 20) return "3.0";
  if (score <= 24) return "3.5";
  if (score <= 28) return "4.0";
  if (score <= 32) return "4.5";
  return "5.0";
}

router.get("/assessments/user/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  const assessments = await db.select().from(skillAssessmentsTable)
    .where(eq(skillAssessmentsTable.userId, userId));

  assessments.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

  res.json(assessments.map(a => ({
    id: a.id,
    userId: a.userId,
    answers: JSON.parse(a.answers ?? "[]"),
    computedLevel: a.computedLevel,
    notes: a.notes ?? null,
    verifiedByAdmin: a.verifiedByAdmin,
    submittedAt: a.submittedAt.toISOString(),
    verifiedAt: a.verifiedAt?.toISOString() ?? null,
  })));
});

router.post("/assessments", async (req, res): Promise<void> => {
  const { userId, answers, score } = req.body;
  if (!userId || !Array.isArray(answers)) {
    res.status(400).json({ error: "userId and answers array required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const totalScore = typeof score === "number" ? score : (answers as number[]).reduce((s: number, a: number) => s + (a || 0), 0);
  const computedLevel = computeLevel(totalScore);

  const [assessment] = await db.insert(skillAssessmentsTable).values({
    userId: Number(userId),
    answers: JSON.stringify(answers),
    computedLevel,
  }).returning();

  await db.update(usersTable).set({ level: computedLevel }).where(eq(usersTable.id, Number(userId)));

  await db.insert(activityLogsTable).values({
    userId: user.id,
    userName: user.name,
    action: "assessment_completed",
    details: `Skill assessment completed — WPT level ${computedLevel}`,
  });

  res.status(201).json({
    id: assessment.id,
    userId: assessment.userId,
    computedLevel: assessment.computedLevel,
    submittedAt: assessment.submittedAt.toISOString(),
  });
});

router.post("/assessments/:id/verify", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { verifiedLevel } = req.body;

  const [assessment] = await db.update(skillAssessmentsTable).set({
    verifiedByAdmin: true,
    verifiedAt: new Date(),
    ...(verifiedLevel ? { computedLevel: verifiedLevel } : {}),
  }).where(eq(skillAssessmentsTable.id, id)).returning();

  if (!assessment) { res.status(404).json({ error: "Assessment not found" }); return; }

  if (verifiedLevel) {
    await db.update(usersTable).set({ level: verifiedLevel, verified: true, verificationDate: new Date() })
      .where(eq(usersTable.id, assessment.userId));
  }

  res.json({ id: assessment.id, computedLevel: assessment.computedLevel, verifiedByAdmin: true });
});

export default router;
