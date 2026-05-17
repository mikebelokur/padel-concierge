import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  real,
} from "drizzle-orm/pg-core";
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
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
