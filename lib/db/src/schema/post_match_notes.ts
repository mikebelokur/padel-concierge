import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { coachingClientsTable } from "./coaching_clients";
import { coachingSessionsTable } from "./coaching_sessions";

export const postMatchNotesTable = pgTable("post_match_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => coachingClientsTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => coachingSessionsTable.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  coachResponse: text("coach_response").notNull().default(""),
  category: text("category").notNull().default("technique"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});
