import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { coachingClientsTable } from "./coaching_clients";

export const recurringSchedulesTable = pgTable("recurring_schedules", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => coachingClientsTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  court: text("court").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
