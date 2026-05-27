import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  real,
  check,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  level: text("level").notNull().default("D"),
  goal: text("goal").notNull().default("Play"),
  intensity: text("intensity").notNull().default("Active-Dynamic"),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  locationName: text("location_name"),
  avatar: text("avatar"),
  verified: boolean("verified").notNull().default(false),
  verificationDate: timestamp("verification_date", { withTimezone: true }),
  role: text("role").notNull().default("player"),
  favouritePlayers: text("favourite_players").array().notNull().default([]),
  availability: text("availability").notNull().default("[]"),
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  language: text("language").notNull().default("en"),
  isOnline: boolean("is_online").notNull().default(false),
  lastActive: timestamp("last_active", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  approvalStatus: text("approval_status").notNull().default("approved"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  archetype: text("archetype"),
  warmUpPreference: boolean("warm_up_preference").notNull().default(false),
  behavioralOverride: text("behavioral_override"),
  levelSelf: real("level_self"),
  levelQuiz: text("level_quiz"),
  physicalSelf: integer("physical_self"),
  warmupFormat: text("warmup_format"),
  userType: text("user_type").notNull().default("real_user"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  reminderOptOut: boolean("reminder_opt_out").notNull().default(false),
  source: text("source").notNull().default("self_signup"),
  memberNumber: integer("member_number")
    .notNull()
    .default(sql`nextval('users_member_number_seq')`)
    .unique(),
  badge: text("badge"),
  inviteStatus: text("invite_status").notNull().default("not_invited"),
  inviteToken: uuid("invite_token"),
  inviteTokenExpiresAt: timestamp("invite_token_expires_at", { withTimezone: true }),
  coachingClientId: integer("coaching_client_id"),
}, t => [
  check("users_user_type_check", sql`${t.userType} IN ('real_user', 'seed_test', 'beta_tester')`),
  check("users_source_check", sql`${t.source} IN ('self_signup', 'coach_added')`),
  check("users_badge_check", sql`${t.badge} IS NULL OR ${t.badge} IN ('founding_member', 'pioneer', 'beta_tester')`),
  check("users_invite_status_check", sql`${t.inviteStatus} IN ('not_invited', 'invited', 'activated', 'declined')`),
  uniqueIndex("users_invite_token_unique").on(t.inviteToken).where(sql`${t.inviteToken} IS NOT NULL`),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
