import { pgTable, serial, text, real, boolean, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clubsTable = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    photoUrl: text("photo_url"),
    address: text("address").notNull(),
    area: text("area").notNull(),
    phone: text("phone"),
    lat: real("lat"),
    lng: real("lng"),
    tier: text("tier").notNull().default("standard"),
    website: text("website"),
    openingHours: jsonb("opening_hours"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("clubs_tier_check", sql`${t.tier} IN ('premium','standard','community')`),
  ],
);

export const insertClubSchema = createInsertSchema(clubsTable).omit({ id: true, createdAt: true });
export type Club = typeof clubsTable.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
