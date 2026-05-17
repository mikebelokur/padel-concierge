import { Router, type IRouter } from "express";
import { db, usersTable, matchesTable, bookingsTable, videoAnalysesTable, activityLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetActivityLogQueryParams } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable);
  const matches = await db.select().from(matchesTable);
  const bookings = await db.select().from(bookingsTable);
  const videos = await db.select().from(videoAnalysesTable);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const paidBookings = bookings.filter(b => b.paymentStatus === "completed");
  const dailyRevenue = paidBookings.filter(b => b.createdAt > dayAgo).length * 120;
  const weeklyRevenue = paidBookings.filter(b => b.createdAt > weekAgo).length * 120;
  const monthlyRevenue = paidBookings.filter(b => b.createdAt > monthAgo).length * 120;

  const levelDistribution: Record<string, number> = {};
  for (const u of users) {
    levelDistribution[u.level] = (levelDistribution[u.level] ?? 0) + 1;
  }

  const topPlayers = [...users]
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
    .slice(0, 5)
    .map(u => ({
      userId: u.id,
      name: u.name,
      matchesPlayed: u.matchesPlayed,
      level: u.level,
      avatar: u.avatar ?? null,
    }));

  const completedVideos = videos.filter(v => v.status === "completed" && v.responseTime != null);
  const avgResponseTime = completedVideos.length > 0
    ? completedVideos.reduce((sum, v) => sum + (v.responseTime ?? 0), 0) / completedVideos.length
    : 0;

  res.json({
    totalUsers: users.length,
    onlineUsers: users.filter(u => u.isOnline).length,
    totalMatches: matches.length,
    confirmedMatches: matches.filter(m => m.status === "confirmed").length,
    cancelledMatches: matches.filter(m => m.status === "cancelled").length,
    completedMatches: matches.filter(m => m.status === "completed").length,
    dailyRevenue,
    weeklyRevenue,
    monthlyRevenue,
    pendingVideoAnalyses: videos.filter(v => v.status === "pending").length,
    inProgressVideoAnalyses: videos.filter(v => v.status === "in_progress").length,
    completedVideoAnalyses: videos.filter(v => v.status === "completed").length,
    avgAnalysisResponseTime: avgResponseTime,
    levelDistribution: Object.entries(levelDistribution).map(([level, count]) => ({ level, count })),
    topPlayers,
  });
});

router.get("/stats/player/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const LEVELS = ["D-", "D", "D+", "C-", "C", "C+"];
  const currentLevelIdx = LEVELS.indexOf(user.level);
  const levelProgress = currentLevelIdx >= 0 ? (currentLevelIdx / (LEVELS.length - 1)) * 100 : 0;
  const winsToNextLevel = Math.max(0, 5 - (user.wins % 5));
  const levelConfidence = Math.min(100, (user.matchesPlayed / Math.max(1, (currentLevelIdx + 1) * 5)) * 100);

  const userBookings = await db.select().from(bookingsTable).where(eq(bookingsTable.userId, id));
  const matchIds = userBookings.map(b => b.matchId);

  const formatBreakdown: Record<string, number> = {};
  for (const matchId of matchIds) {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (match) {
      formatBreakdown[match.format] = (formatBreakdown[match.format] ?? 0) + 1;
    }
  }

  const winTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toISOString().split("T")[0],
      winRate: Math.random() * 0.4 + 0.3,
    };
  });

  res.json({
    userId: id,
    matchesPlayed: user.matchesPlayed,
    wins: user.wins,
    winRate: user.matchesPlayed > 0 ? user.wins / user.matchesPlayed : 0,
    levelProgress,
    winsToNextLevel,
    levelConfidence,
    formatBreakdown: Object.entries(formatBreakdown).map(([format, count]) => ({ format, count })),
    winTrend,
    frequentPartners: [],
  });
});

router.get("/stats/activity", requireAdmin, async (req, res): Promise<void> => {
  const params = GetActivityLogQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? params.data.limit : 50;

  const logs = await db.select().from(activityLogsTable)
    .orderBy(activityLogsTable.createdAt)
    .limit(limit);

  res.json(logs.map(l => ({
    id: l.id,
    userId: l.userId,
    userName: l.userName,
    action: l.action,
    details: l.details ?? null,
    createdAt: l.createdAt.toISOString(),
  })).reverse());
});

export default router;
