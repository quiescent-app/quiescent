import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

import { users } from "./user.schema.js";

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    url: text("url").notNull(),

    domain: text("domain").notNull(),

    content: text("content"),

    readingProgress: integer("reading_progress").default(0).notNull(),

    lastAccessedAt: timestamp("last_accessed_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("articles_user_url_unique").on(table.userId, table.url),

    index("articles_user_id_idx").on(table.userId),

    index("articles_domain_idx").on(table.domain),

    index("articles_last_accessed_idx").on(table.lastAccessedAt),

    check(
      "articles_reading_progress_check",
      sql`${table.readingProgress} BETWEEN 0 AND 100`,
    ),
  ],
);

export type ArticleRecord = typeof articles.$inferSelect;
export type NewArticleRecord = typeof articles.$inferInsert;
