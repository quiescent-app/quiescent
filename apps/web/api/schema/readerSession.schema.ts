import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";
import { readerResources } from "./readerResource.schema.js";

const date = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const readerSessions = pgTable("reader_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull(),
  scrollOffset: integer("scroll_offset"),
  pageNumber: integer("page_number"),
  initialProgress: integer("initial_progress").default(0).notNull(),
  progress: integer("progress").default(0).notNull(),
  status: text("status", { enum: ["active", "completed", "failed"] }).default("active").notNull(),
  failureCode: text("failure_code", { enum: ["unavailable", "expired", "unsupported"] }),
  endedAt: date("ended_at"),
  createdAt: date("created_at").defaultNow().notNull(),
  updatedAt: date("updated_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({ name: "reader_session_owner_fk", columns: [t.resourceId, t.userId], foreignColumns: [readerResources.id, readerResources.userId] }).onDelete("cascade"),
  index("reader_session_recent_idx").on(t.userId, t.createdAt),
  index("reader_session_resource_recent_idx").on(t.resourceId, t.userId, t.createdAt.desc(), t.id.desc()),
  uniqueIndex("reader_session_ongoing_unique").on(t.resourceId).where(sql`${t.endedAt} IS NULL`),
  check("reader_session_initial_progress_check", sql`${t.initialProgress} BETWEEN 0 AND 100`),
  check("reader_session_end_check", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.createdAt}`),
  check("reader_session_progress_check", sql`${t.progress} BETWEEN 0 AND 100 AND (${t.status} <> 'completed' OR ${t.progress} = 100)`),
  check("reader_session_position_check", sql`(${t.scrollOffset} IS NULL OR ${t.scrollOffset} >= 0) AND (${t.pageNumber} IS NULL OR ${t.pageNumber} >= 1) AND NOT (${t.scrollOffset} IS NOT NULL AND ${t.pageNumber} IS NOT NULL)`),
  check("reader_session_status_check", sql`${t.status} IN ('active','completed','failed')`),
  check("reader_session_failure_check", sql`(${t.status} = 'failed' AND ${t.failureCode} IS NOT NULL AND ${t.failureCode} IN ('unavailable','expired','unsupported')) OR (${t.status} <> 'failed' AND ${t.failureCode} IS NULL)`),
]);

export type ReaderSession = typeof readerSessions.$inferSelect;
