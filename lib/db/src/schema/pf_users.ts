import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const pfUsersTable = pgTable("pf_users", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
});

export type PfUser = typeof pfUsersTable.$inferSelect;
export type InsertPfUser = typeof pfUsersTable.$inferInsert;
