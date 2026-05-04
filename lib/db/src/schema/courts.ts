import { pgTable, serial, text, real, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const courtsTable = pgTable("courts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  address: text("address").notNull(),
  pricePerHour: real("price_per_hour").notNull().default(120),
  amenities: text("amenities").notNull().default("[]"),
  surface: text("surface").notNull().default("clay"),
  indoor: boolean("indoor").notNull().default(false),
  imageUrl: text("image_url"),
  availableSlots: text("available_slots")
    .notNull()
    .default('["08:00","09:30","11:00","14:00","15:30","17:00","19:00"]'),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courtBookingsTable = pgTable("court_bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courtId: integer("court_id").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("confirmed"),
  totalPrice: real("total_price").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const insertCourtSchema = createInsertSchema(courtsTable).omit({ id: true, createdAt: true });
export const insertCourtBookingSchema = createInsertSchema(courtBookingsTable).omit({ id: true, createdAt: true });
export type Court = typeof courtsTable.$inferSelect;
export type CourtBooking = typeof courtBookingsTable.$inferSelect;
export type InsertCourt = z.infer<typeof insertCourtSchema>;
export type InsertCourtBooking = z.infer<typeof insertCourtBookingSchema>;
