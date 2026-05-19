import { pgTable, serial, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const feedbackAggregatesTable = pgTable("feedback_aggregates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  totalRatings: integer("total_ratings").notNull().default(0),
  averageRating: real("average_rating").notNull().default(0),
  traitFrequency: jsonb("trait_frequency").notNull().default({}),
  anonymousReviewerCount: integer("anonymous_reviewer_count").notNull().default(0),
  hashedReviewerIds: text("hashed_reviewer_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeedbackAggregate = typeof feedbackAggregatesTable.$inferSelect;
export type InsertFeedbackAggregate = typeof feedbackAggregatesTable.$inferInsert;
