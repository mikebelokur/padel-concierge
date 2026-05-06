import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const matchFeedbackTable = pgTable("match_feedback", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  aboutUserId: integer("about_user_id").notNull(),
  rating: integer("rating").notNull().default(5),
  traits: text("traits").array().notNull().default([]),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
