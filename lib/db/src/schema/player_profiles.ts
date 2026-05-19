import { pgTable, serial, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const playerProfilesTable = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  reliabilityScore: real("reliability_score").notNull().default(75),
  noShowCount: integer("no_show_count").notNull().default(0),
  sessionStreak: integer("session_streak").notNull().default(0),
  behavioralFlags: text("behavioral_flags").array().notNull().default([]),
  last30MatchIds: jsonb("last30_match_ids").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlayerProfile = typeof playerProfilesTable.$inferSelect;
export type InsertPlayerProfile = typeof playerProfilesTable.$inferInsert;
