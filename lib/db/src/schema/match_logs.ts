import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const matchLogsTable = pgTable("match_logs", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().unique(),
  date: text("date").notNull().default(""),
  participants: jsonb("participants").notNull().default([]),
  setScores: jsonb("set_scores").notNull().default([]),
  rawSetScores: text("raw_set_scores").notNull().default(""),
  conflictEvents: jsonb("conflict_events").notNull().default([]),
  timeline: jsonb("timeline").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MatchLog = typeof matchLogsTable.$inferSelect;
export type InsertMatchLog = typeof matchLogsTable.$inferInsert;
