import { pgTable, serial, integer, real, text, timestamp, jsonb, date } from "drizzle-orm/pg-core";

export const playerProfilesTable = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  reliabilityScore: real("reliability_score").notNull().default(75),
  noShowCount: integer("no_show_count").notNull().default(0),
  sessionStreak: integer("session_streak").notNull().default(0),
  behavioralFlags: text("behavioral_flags").array().notNull().default([]),
  last30MatchIds: jsonb("last30_match_ids").notNull().default([]),
  // --- Onboarding "Welcome" questionnaire (Stage 1) ---
  // Personal profile captured right after registration. Stored here (1:1 to
  // users) rather than on the users table to keep onboarding data separate.
  gender: text("gender"),                                   // female | male | other | prefer_not
  ageRange: text("age_range"),                              // 18-25 | 26-35 | 36-45 | 46-55 | 55+
  birthDate: date("birth_date"),                            // reserved: exact DOB if collected later
  experienceYears: text("experience_years"),                // <6m | 6-12m | 1-3y | 3-5y | 5+
  limitations: text("limitations").array().notNull().default([]), // none | back | knees | shoulder | unsure
  communicationStyle: text("communication_style"),          // direct | supportive | analytical | motivating | unsure
  welcomeCompletedAt: timestamp("welcome_completed_at", { withTimezone: true }),
  // Onboarding raises matchmaking compatibility — Stage 1 seeds the field that
  // later quizzes (Stages 3-5) will increment.
  compatibilityBias: real("compatibility_bias").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlayerProfile = typeof playerProfilesTable.$inferSelect;
export type InsertPlayerProfile = typeof playerProfilesTable.$inferInsert;
