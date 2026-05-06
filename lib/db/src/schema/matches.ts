import {
  pgTable,
  serial,
  text,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  clubName: text("club_name").notNull(),
  format: text("format").notNull().default("Simplified"),
  players: text("players").notNull().default("[]"),
  status: text("status").notNull().default("suggested"),
  price: real("price").notNull().default(120),
  levelMin: text("level_min"),
  levelMax: text("level_max"),
  matchType: text("match_type").notNull().default("balanced"),
  balanceScore: real("balance_score"),
  setScores: text("set_scores").notNull().default(""),
  playerRatings: text("player_ratings").notNull().default("{}"),
  conflictOccurred: text("conflict_occurred").notNull().default("false"),
  overallNote: text("overall_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
