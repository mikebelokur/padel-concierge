import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reminderLogsTable = pgTable("reminder_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  triggeredBy: text("triggered_by").notNull(),
  senderUserId: integer("sender_user_id"),
  delivered: boolean("delivered").notNull().default(true),
}, t => [
  index("reminder_logs_user_id_idx").on(t.userId),
]);

export const insertReminderLogSchema = createInsertSchema(reminderLogsTable).omit({
  id: true,
  sentAt: true,
});
export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogsTable.$inferSelect;
