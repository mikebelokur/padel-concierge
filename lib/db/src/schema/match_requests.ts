import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchRequestsTable = pgTable("match_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  proposedDate: text("proposed_date"),
  proposedTime: text("proposed_time"),
  matchId: integer("match_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMatchRequestSchema = createInsertSchema(matchRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MatchRequest = typeof matchRequestsTable.$inferSelect;
export type InsertMatchRequest = z.infer<typeof insertMatchRequestSchema>;
