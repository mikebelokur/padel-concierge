import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const padelNewsTable = pgTable("padel_news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("global_news"),
  author: text("author").notNull().default("Misha"),
  imageUrl: text("image_url"),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
