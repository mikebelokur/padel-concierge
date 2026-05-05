import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const padelRulesTable = pgTable("padel_rules", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  titleEn: text("title_en").notNull(),
  titleRu: text("title_ru").notNull(),
  titleAr: text("title_ar").notNull(),
  ruleEn: text("rule_en").notNull(),
  ruleRu: text("rule_ru").notNull(),
  ruleAr: text("rule_ar").notNull(),
  keywords: text("keywords").array().notNull().default([]),
  sortOrder: text("sort_order").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
