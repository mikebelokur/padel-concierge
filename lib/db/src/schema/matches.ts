import {
  pgTable,
  serial,
  text,
  timestamp,
  real,
  integer,
  boolean,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  clubName: text("club_name").notNull(),
  format: text("format").notNull().default("Simplified"),
  players: text("players").notNull().default("[]"),
  status: text("status").notNull().default("suggested"),
  price: real("price").notNull().default(120),
  levelMin: text("level_min"),
  levelMax: text("level_max"),
  matchType: text("match_type").notNull().default("balanced"),
  balanceScore: real("balance_score"),
  setScores: text("set_scores").notNull().default(""),
  playerRatings: text("player_ratings").notNull().default("{}"),
  conflictOccurred: boolean("conflict_occurred").notNull().default(false),
  overallNote: text("overall_note").notNull().default(""),
  // ── Play / Create-Match flow (additive) ────────────────────────────────
  // Creator / match leader. Nullable so legacy/suggested matches are untouched.
  creatorId: integer("creator_id"),
  // 'unranked' | 'competitive' | 'personal'. Null = legacy match.
  matchKind: text("match_kind"),
  // 'private' | 'open'
  visibility: text("visibility").notNull().default("private"),
  // Personal match goal: 'win' | 'fun' | 'learning' | 'energy'
  goal: text("goal"),
  // Personal match free-text style / vibe description.
  styleNote: text("style_note"),
  // Slot duration in minutes (>= 150 enforced at API).
  slotMinutes: integer("slot_minutes"),
  // Roster capacity. Fixed at 4 (2v2) for the new flow.
  maxPlayers: integer("max_players").notNull().default(4),
  // Unique shareable invite token (link join).
  inviteToken: uuid("invite_token"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  uniqueIndex("matches_invite_token_unique").on(t.inviteToken).where(sql`${t.inviteToken} IS NOT NULL`),
]);

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
