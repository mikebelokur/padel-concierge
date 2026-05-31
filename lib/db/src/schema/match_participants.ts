import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchParticipantsTable = pgTable(
  "match_participants",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    userId: integer("user_id").notNull(),
    // 'leader' (match admin / creator) | 'player'
    role: text("role").notNull().default("player"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("match_participants_match_user_unique").on(t.matchId, t.userId),
    index("match_participants_match_idx").on(t.matchId),
    check("match_participants_role_check", sql`${t.role} IN ('leader','player')`),
  ],
);

export const insertMatchParticipantSchema = createInsertSchema(matchParticipantsTable).omit({
  id: true,
  joinedAt: true,
});
export type MatchParticipant = typeof matchParticipantsTable.$inferSelect;
export type InsertMatchParticipant = z.infer<typeof insertMatchParticipantSchema>;
