import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillAssessmentsTable = pgTable("skill_assessments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  answers: text("answers").notNull().default("[]"),
  computedLevel: text("computed_level").notNull(),
  notes: text("notes"),
  verifiedByAdmin: boolean("verified_by_admin").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const insertSkillAssessmentSchema = createInsertSchema(skillAssessmentsTable).omit({
  id: true,
  submittedAt: true,
});
export type SkillAssessment = typeof skillAssessmentsTable.$inferSelect;
export type InsertSkillAssessment = z.infer<typeof insertSkillAssessmentSchema>;
