import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { coachingClientsTable } from "./coaching_clients";

export const coachingMessagesTable = pgTable("coaching_messages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => coachingClientsTable.id, { onDelete: "cascade" }),
  direction: text("direction").notNull().default("in"),
  content: text("content").notNull(),
  channel: text("channel").notNull().default("whatsapp"),
  read: boolean("read").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});
