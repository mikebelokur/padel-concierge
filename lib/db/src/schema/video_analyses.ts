import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videoAnalysesTable = pgTable("video_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  videoUrl: text("video_url").notNull(),
  playerShirtColor: text("player_shirt_color").notNull(),
  analysisQuery: text("analysis_query"),
  status: text("status").notNull().default("pending"),
  assignedCoachId: integer("assigned_coach_id"),
  analysisReport: text("analysis_report"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  responseTime: real("response_time"),
  uploadDate: timestamp("upload_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVideoAnalysisSchema = createInsertSchema(videoAnalysesTable).omit({
  id: true,
  uploadDate: true,
});
export type InsertVideoAnalysis = z.infer<typeof insertVideoAnalysisSchema>;
export type VideoAnalysis = typeof videoAnalysesTable.$inferSelect;
