import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const trainerMatchRequestsTable = pgTable("trainer_match_requests", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  format: text("format").notNull().default("4v4"),
  venue: text("venue").notNull().default("Padel Edition"),
  requestedDate: text("requested_date").notNull(),
  requestedTime: text("requested_time").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("pending"),
  assignedMatchId: integer("assigned_match_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
