import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  numeric,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";
import { usersTable } from "./users";

export const clubSlotsTable = pgTable(
  "club_slots",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    courtNumber: text("court_number"),
    priceAed: numeric("price_aed", { precision: 10, scale: 2 }),
    levelSuitability: text("level_suitability"),
    notes: text("notes"),
    status: text("status").notNull().default("open"),
    recurringSeriesId: text("recurring_series_id"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("club_slots_club_date_idx").on(t.clubId, t.date),
    check(
      "club_slots_status_check",
      sql`${t.status} IN ('open','taken','cancelled')`,
    ),
  ],
);

export const insertClubSlotSchema = createInsertSchema(clubSlotsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ClubSlot = typeof clubSlotsTable.$inferSelect;
export type InsertClubSlot = z.infer<typeof insertClubSlotSchema>;

export const slotInterestsTable = pgTable(
  "slot_interests",
  {
    id: serial("id").primaryKey(),
    slotId: integer("slot_id")
      .notNull()
      .references(() => clubSlotsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("slot_interests_slot_user_uidx").on(t.slotId, t.userId),
    index("slot_interests_user_idx").on(t.userId),
  ],
);

export const insertSlotInterestSchema = createInsertSchema(slotInterestsTable).omit({
  id: true,
  createdAt: true,
});
export type SlotInterest = typeof slotInterestsTable.$inferSelect;
export type InsertSlotInterest = z.infer<typeof insertSlotInterestSchema>;
