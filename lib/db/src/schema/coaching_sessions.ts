import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { coachingClientsTable } from "./coaching_clients";

export const coachingSessionsTable = pgTable("coaching_sessions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => coachingClientsTable.id, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull().default(1),
  topic: text("topic").notNull(),
  subtopics: text("subtopics").array().notNull().default([]),
  date: text("date").notNull(),
  time: text("time").notNull().default("09:30"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  court: text("court").notNull().default(""),
  status: text("status").notNull().default("completed"),
  coachNotes: text("coach_notes").notNull().default(""),
  drillsCovered: text("drills_covered").array().notNull().default([]),
  nextSessionFocus: text("next_session_focus").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
