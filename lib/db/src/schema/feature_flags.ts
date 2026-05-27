import { pgTable, text, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const featureFlagsTable = pgTable(
  "feature_flags",
  {
    name: text("name").primaryKey(),
    minTier: text("min_tier").notNull(),
    status: text("status").notNull(),
  },
  (t) => [
    check(
      "feature_flags_min_tier_check",
      sql`${t.minTier} IN ('player', 'coach', 'admin', 'developer')`,
    ),
    check(
      "feature_flags_status_check",
      sql`${t.status} IN ('shipped', 'partial', 'dev_only')`,
    ),
  ],
);

export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
