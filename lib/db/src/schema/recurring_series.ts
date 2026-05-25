import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const recurringSeriesTable = pgTable(
  "recurring_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coachId: integer("coach_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    category: text("category").notNull(),
    courtName: text("court_name").notNull(),
    courtAddress: text("court_address"),
    maxParticipants: integer("max_participants").notNull().default(4),
    priceAed: numeric("price_aed", { precision: 10, scale: 2 }).notNull(),
    descriptionEn: text("description_en"),
    descriptionRu: text("description_ru"),
    active: boolean("active").notNull().default(true),
    untilDate: date("until_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recurring_series_coach_active_idx").on(t.coachId, t.active),
    check(
      "recurring_series_weekday_check",
      sql`${t.weekday} BETWEEN 0 AND 6`,
    ),
    check(
      "recurring_series_category_check",
      sql`${t.category} IN ('D-','D','D+','C-','C','C+','B-')`,
    ),
  ],
);

export const insertRecurringSeriesSchema = createInsertSchema(recurringSeriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type RecurringSeries = typeof recurringSeriesTable.$inferSelect;
export type InsertRecurringSeries = z.infer<typeof insertRecurringSeriesSchema>;
