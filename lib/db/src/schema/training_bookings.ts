import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groupTrainingsTable } from "./group_trainings";
import { usersTable } from "./users";

export const trainingBookingsTable = pgTable(
  "training_bookings",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id")
      .notNull()
      .references(() => groupTrainingsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("booked"),
    bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("training_bookings_user_status_idx").on(t.userId, t.status),
    uniqueIndex("training_bookings_active_unique_idx")
      .on(t.trainingId, t.userId)
      .where(sql`${t.status} <> 'cancelled'`),
    check(
      "training_bookings_status_check",
      sql`${t.status} IN ('booked','cancelled','attended','no_show')`,
    ),
  ],
);

export const insertTrainingBookingSchema = createInsertSchema(trainingBookingsTable).omit({
  id: true,
  bookedAt: true,
  createdAt: true,
});
export type TrainingBooking = typeof trainingBookingsTable.$inferSelect;
export type InsertTrainingBooking = z.infer<typeof insertTrainingBookingSchema>;
