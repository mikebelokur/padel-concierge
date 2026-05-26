import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const pfQuizResultsTable = pgTable("pf_quiz_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  quizLevel: varchar("quiz_level"),
  realLevel: varchar("real_level"),
  q1Answer: integer("q1_answer"),
  q2Answer: integer("q2_answer"),
  q3Answer: integer("q3_answer"),
  q4Answer: varchar("q4_answer"),
  q4Extra: text("q4_extra"),
  q5Answer: varchar("q5_answer"),
  q6Answer: varchar("q6_answer"),
  q7Answer: varchar("q7_answer"),
  q8Answer: varchar("q8_answer"),
  q9Answer: varchar("q9_answer"),
  q10Answer: varchar("q10_answer"),
  personalityType: varchar("personality_type"),
  completedAt: timestamp("completed_at", { withTimezone: false }).defaultNow(),
  sessionId: text("session_id"),
});

export type PfQuizResult = typeof pfQuizResultsTable.$inferSelect;
export type InsertPfQuizResult = typeof pfQuizResultsTable.$inferInsert;
