import { pgTable, serial, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const compatibilityScoresTable = pgTable("compatibility_scores", {
  id: serial("id").primaryKey(),
  pairKey: text("pair_key").notNull().unique(),
  userIdA: integer("user_id_a").notNull(),
  userIdB: integer("user_id_b").notNull(),
  score: real("score").notNull().default(50),
  factors: jsonb("factors").notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CompatibilityScore = typeof compatibilityScoresTable.$inferSelect;
export type InsertCompatibilityScore = typeof compatibilityScoresTable.$inferInsert;
