import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";

export const coachingClientsTable = pgTable("coaching_clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  level: text("level").notNull().default("C"),
  bookingPattern: text("booking_pattern").notNull().default("on_demand"),
  pricePerSession: real("price_per_session").notNull().default(700),
  status: text("status").notNull().default("active"),
  notes: text("notes").notNull().default(""),
  avatarInitials: text("avatar_initials").notNull().default(""),
  totalSessions: integer("total_sessions").notNull().default(0),
  totalRevenue: real("total_revenue").notNull().default(0),
  packageType: text("package_type").notNull().default("per_session"),
  sessionsInPackage: integer("sessions_in_package").notNull().default(0),
  sessionsUsed: integer("sessions_used").notNull().default(0),
  lastSessionDate: timestamp("last_session_date", { withTimezone: true }),
  nextSessionDate: timestamp("next_session_date", { withTimezone: true }),
  nextSessionPlan: text("next_session_plan").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
