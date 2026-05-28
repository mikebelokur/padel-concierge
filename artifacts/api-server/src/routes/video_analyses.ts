import { Router, type IRouter } from "express";
import { db, videoAnalysesTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateVideoAnalysisBody, UpdateVideoAnalysisBody, ListVideoAnalysesQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

function formatVideoAnalysis(v: typeof videoAnalysesTable.$inferSelect) {
  return {
    id: v.id,
    userId: v.userId,
    videoUrl: v.videoUrl,
    playerShirtColor: v.playerShirtColor,
    analysisQuery: v.analysisQuery ?? null,
    status: v.status,
    assignedCoachId: v.assignedCoachId ?? null,
    analysisReport: v.analysisReport ? JSON.parse(v.analysisReport) : null,
    deliveredAt: v.deliveredAt?.toISOString() ?? null,
    responseTime: v.responseTime ?? null,
    uploadDate: v.uploadDate.toISOString(),
  };
}

router.get("/video-analysis", async (req, res): Promise<void> => {
  const params = ListVideoAnalysesQueryParams.safeParse(req.query);
  let analyses = await db.select().from(videoAnalysesTable).orderBy(videoAnalysesTable.uploadDate);

  if (params.success) {
    if (params.data.userId) {
      analyses = analyses.filter(a => a.userId === params.data.userId);
    }
    if (params.data.status) {
      analyses = analyses.filter(a => a.status === params.data.status);
    }
  }

  res.json(analyses.map(formatVideoAnalysis));
});

router.post("/video-analysis", async (req, res): Promise<void> => {
  const parsed = CreateVideoAnalysisBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [analysis] = await db.insert(videoAnalysesTable).values({
    userId: parsed.data.userId,
    videoUrl: parsed.data.videoUrl,
    playerShirtColor: parsed.data.playerShirtColor,
    analysisQuery: parsed.data.analysisQuery ?? null,
    status: "pending",
  }).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (user) {
    await db.insert(activityLogsTable).values({
      userId: user.id,
      userName: user.name,
      action: "video_uploaded",
      details: `Uploaded video for analysis (${parsed.data.playerShirtColor} shirt)`,
      detailsParams: { shirtColor: parsed.data.playerShirtColor },
    });
  }

  res.status(201).json(formatVideoAnalysis(analysis));
});

router.get("/video-analysis/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [analysis] = await db.select().from(videoAnalysesTable).where(eq(videoAnalysesTable.id, id));
  if (!analysis) { res.status(404).json({ error: "Video analysis not found" }); return; }
  res.json(formatVideoAnalysis(analysis));
});

router.patch("/video-analysis/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateVideoAnalysisBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const now = new Date();
  const [existing] = await db.select().from(videoAnalysesTable).where(eq(videoAnalysesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Video analysis not found" }); return; }

  const isBeingDelivered = parsed.data.status === "completed" && existing.status !== "completed";
  const responseTime = isBeingDelivered
    ? (now.getTime() - existing.uploadDate.getTime()) / (1000 * 60 * 60)
    : existing.responseTime;

  const [analysis] = await db.update(videoAnalysesTable).set({
    ...(parsed.data.status && { status: parsed.data.status }),
    ...(parsed.data.assignedCoachId !== undefined && { assignedCoachId: parsed.data.assignedCoachId }),
    ...(parsed.data.analysisReport !== undefined && { analysisReport: JSON.stringify(parsed.data.analysisReport) }),
    ...(isBeingDelivered && { deliveredAt: now, responseTime }),
  }).where(eq(videoAnalysesTable.id, id)).returning();

  if (isBeingDelivered) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, existing.userId));
    if (user) {
      await db.insert(activityLogsTable).values({
        userId: user.id,
        userName: user.name,
        action: "analysis_delivered",
        details: `Video analysis delivered in ${responseTime?.toFixed(1)}h`,
        detailsParams: { hours: Number(responseTime?.toFixed(1) ?? 0) },
      });
    }
  }

  res.json(formatVideoAnalysis(analysis));
});

export default router;
