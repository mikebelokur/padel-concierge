import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  numeric,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const groupTrainingsTable = pgTable(
  "group_trainings",
  {
    id: serial("id").primaryKey(),
    coachId: integer("coach_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    dateTime: timestamp("date_time", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    category: text("category").notNull(),
    courtName: text("court_name").notNull(),
    courtAddress: text("court_address"),
    maxParticipants: integer("max_participants").notNull().default(4),
    priceAed: numeric("price_aed", { precision: 10, scale: 2 }).notNull(),
    descriptionEn: text("description_en"),
    descriptionRu: text("description_ru"),
    status: text("status").notNull().default("open"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurringSeriesId: integer("recurring_series_id"),
    recurringPattern: text("recurring_pattern"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("group_trainings_coach_date_idx").on(t.coachId, t.dateTime),
    index("group_trainings_series_idx").on(t.recurringSeriesId),
    check(
      "group_trainings_category_check",
      sql`${t.category} IN ('D-','D','D+','C-','C','C+','B-')`,
    ),
    check(
      "group_trainings_status_check",
      sql`${t.status} IN ('open','full','cancelled','completed')`,
    ),
  ],
);

export const insertGroupTrainingSchema = createInsertSchema(groupTrainingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GroupTraining = typeof groupTrainingsTable.$inferSelect;
export type InsertGroupTraining = z.infer<typeof insertGroupTrainingSchema>;
