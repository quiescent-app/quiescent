import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";

const date = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const readerResources = pgTable("reader_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceType: text("source_type", { enum: ["url", "pdf"] }).notNull(),
  canonicalUrl: text("canonical_url"),
  // Reserved for #29's private object reference; unavailable until its contract exists.
  pdfObjectReference: text("pdf_object_reference"),
  title: text("title").notNull(),
  sourceDomain: text("source_domain"),
  status: text("status", { enum: ["not_started", "reading", "finished"] }).default("not_started").notNull(),
  lastAccessedAt: date("last_accessed_at"),
  createdAt: date("created_at").defaultNow().notNull(),
  updatedAt: date("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("reader_resource_owner_unique").on(t.id, t.userId),
  uniqueIndex("reader_user_url_unique").on(t.userId, t.canonicalUrl),
  index("reader_resource_user_status_recent_idx").on(t.userId, t.status, t.lastAccessedAt.desc().nullsLast(), t.createdAt.desc()),
  check("reader_resource_title_check", sql`length(trim(${t.title})) > 0`),
  check("reader_resource_status_check", sql`${t.status} IN ('not_started','reading','finished')`),
  check("reader_resource_source_check", sql`(
    ${t.sourceType} = 'url' AND ${t.canonicalUrl} IS NOT NULL AND
    ${t.canonicalUrl} ~ '^https?://[^/@?#[:space:]]+/[^#[:space:]]*$' AND
    ${t.sourceDomain} IS NOT NULL AND length(trim(${t.sourceDomain})) > 0 AND
    ${t.pdfObjectReference} IS NULL
  ) OR (
    ${t.sourceType} = 'pdf' AND ${t.canonicalUrl} IS NULL AND ${t.sourceDomain} IS NULL AND
    ${t.pdfObjectReference} IS NULL
  )`),
]);

export type ReaderResource = typeof readerResources.$inferSelect;
