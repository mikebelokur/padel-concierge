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

export const matchJoinRequestsTable = pgTable(
  "match_join_requests",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    userId: integer("user_id").notNull(),
    // 'invite'  → leader invited this user (friends-list invite)
    // 'request' → this user asked to join an open match
    type: text("type").notNull(),
    // 'pending' | 'approved' | 'declined'
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A user can have at most one pending invite/request per match.
    uniqueIndex("match_join_requests_pending_unique")
      .on(t.matchId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("match_join_requests_match_idx").on(t.matchId),
    index("match_join_requests_user_idx").on(t.userId),
    check("match_join_requests_type_check", sql`${t.type} IN ('invite','request')`),
    check("match_join_requests_status_check", sql`${t.status} IN ('pending','approved','declined')`),
  ],
);

export const insertMatchJoinRequestSchema = createInsertSchema(matchJoinRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MatchJoinRequest = typeof matchJoinRequestsTable.$inferSelect;
export type InsertMatchJoinRequest = z.infer<typeof insertMatchJoinRequestSchema>;
