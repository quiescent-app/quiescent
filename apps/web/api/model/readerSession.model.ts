import { randomUUID } from "node:crypto";
import { and, desc, eq, exists, isNull, sql } from "drizzle-orm";
import { database } from "../db/client.js";
import { readerResources, type ReaderResource } from "../schema/readerResource.schema.js";
import { readerSessions, type ReaderSession } from "../schema/readerSession.schema.js";
import type { ReaderOwner } from "./readerResource.model.js";

export type ReaderProgressInput = Pick<ReaderSession, "progress" | "scrollOffset" | "pageNumber">;
export type OpeningResourceStatusChange = {
  from: ReaderResource["status"];
  to: ReaderResource["status"];
};

function usableSource() {
  return sql`((${readerResources.sourceType} = 'url' AND ${readerResources.url} IS NOT NULL)
    OR (${readerResources.sourceType} = 'pdf' AND ${readerResources.pdfObjectReference} IS NOT NULL))`;
}

/** Stores each visit to a resource and keeps previous reading sessions. */
export class ReaderSessionModel {
  /** Finds this user's newest session for a resource, even if it has ended. Returns null if none exists. */
  async findLatestSession(owner: ReaderOwner, resourceId: string): Promise<ReaderSession | null> {
    const [session] = await database.select().from(readerSessions)
      .where(and(eq(readerSessions.userId, owner.userId), eq(readerSessions.resourceId, resourceId)))
      .orderBy(sql`${readerSessions.createdAt} DESC NULLS LAST`, sql`${readerSessions.id} DESC NULLS LAST`).limit(1);
    return session ?? null;
  }

  /**
   * Starts a new session using the previous session's progress and reading position.
   * Ends the previous open session and updates when the resource was last opened.
   * The supplied status change applies only when the resource's old status matches.
   * All changes succeed together or are undone together. Returns null if the resource cannot be opened.
   */
  async open(
    owner: ReaderOwner, resourceId: string, resourceStatusChange: OpeningResourceStatusChange | null,
  ): Promise<ReaderSession | null> {
    const owned = and(eq(readerResources.id, resourceId), eq(readerResources.userId, owner.userId));
    const id = randomUUID();
    const readable = and(owned, usableSource(), sql`NOT EXISTS (
      SELECT 1 FROM reader_sessions AS previous
      WHERE previous.id = (SELECT id FROM reader_sessions
        WHERE resource_id = ${resourceId} AND user_id = ${owner.userId}
        ORDER BY created_at DESC NULLS LAST, id DESC NULLS LAST LIMIT 1)
      AND ((${readerResources.sourceType} = 'url' AND previous.page_number IS NOT NULL)
        OR (${readerResources.sourceType} = 'pdf' AND previous.scroll_offset IS NOT NULL))
    )`);
    const openedAt = sql`(SELECT created_at FROM reader_sessions WHERE id = ${id} AND user_id = ${owner.userId})`;
    const [, , , , inserted] = await database.batch([
      database.select({ id: readerResources.id }).from(readerResources).where(owned).for("update"),
      database.update(readerSessions).set({ endedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
        .where(and(eq(readerSessions.resourceId, resourceId), eq(readerSessions.userId, owner.userId), isNull(readerSessions.endedAt),
          exists(database.select({ id: readerResources.id }).from(readerResources).where(readable)))),
      database.execute(sql`WITH visit AS MATERIALIZED (SELECT clock_timestamp() AS opened_at)
        INSERT INTO ${readerSessions}
          (id, user_id, resource_id, initial_progress, progress,
           scroll_offset, page_number, status, failure_code, created_at, updated_at)
        SELECT ${id}::uuid, ${readerResources.userId}, ${readerResources.id},
          COALESCE(previous.progress, 0), COALESCE(previous.progress, 0),
          previous.scroll_offset, previous.page_number,
          COALESCE(previous.status, 'active'), previous.failure_code,
          visit.opened_at, visit.opened_at
        FROM ${readerResources} CROSS JOIN visit
        LEFT JOIN LATERAL (SELECT * FROM reader_sessions
          WHERE resource_id = ${readerResources.id} AND user_id = ${owner.userId}
          ORDER BY created_at DESC NULLS LAST, id DESC NULLS LAST LIMIT 1) AS previous ON true
        WHERE ${readable}`),
      database.update(readerResources).set({
        ...(resourceStatusChange ? {
          status: sql`CASE WHEN ${readerResources.status} = ${resourceStatusChange.from}
            THEN ${resourceStatusChange.to} ELSE ${readerResources.status} END`,
        } : {}),
        lastAccessedAt: openedAt, updatedAt: openedAt,
      })
        .where(and(owned, exists(database.select({ id: readerSessions.id }).from(readerSessions)
          .where(and(eq(readerSessions.id, id), eq(readerSessions.userId, owner.userId)))))),
      database.select().from(readerSessions)
        .where(and(eq(readerSessions.id, id), eq(readerSessions.userId, owner.userId))),
    ]);
    return inserted[0] ?? null;
  }

  /** Finds this user's session, including one that has ended. Returns null if not found. */
  async findById(owner: ReaderOwner, id: string) {
    const [session] = await database.select().from(readerSessions).where(and(eq(readerSessions.id, id), eq(readerSessions.userId, owner.userId))).limit(1);
    return session ?? null;
  }

  /** Lists all of this user's sessions, newest first. */
  async recent(owner: ReaderOwner): Promise<ReaderSession[]> {
    return database.select().from(readerSessions)
      .where(eq(readerSessions.userId, owner.userId))
      .orderBy(desc(readerSessions.createdAt));
  }

  /**
   * Saves progress, position, and modification time for this user's open session.
   * Leaves the resource's status unchanged. Returns the updated session, or null if no update was possible.
   */
  async updateProgress(
    owner: ReaderOwner, id: string, input: ReaderProgressInput,
  ): Promise<ReaderSession | null> {
    const [updated] = await database.update(readerSessions).set({
      progress: input.progress,
      scrollOffset: input.scrollOffset, pageNumber: input.pageNumber,
      updatedAt: sql`clock_timestamp()`,
    }).where(and(
      eq(readerSessions.id, id), eq(readerSessions.userId, owner.userId), isNull(readerSessions.endedAt),
    )).returning();
    return updated ?? null;
  }

  /**
   * Saves status, failure code, and modification time for this user's open session.
   * Returns the updated session, or null if it is missing, belongs to another user, or has ended.
   */
  async setStatus(
    owner: ReaderOwner, id: string, status: ReaderSession["status"],
    failureCode: ReaderSession["failureCode"] = null,
  ): Promise<ReaderSession | null> {
    const [session] = await database.update(readerSessions).set({
      status, failureCode, updatedAt: sql`clock_timestamp()`,
    }).where(and(
      eq(readerSessions.id, id), eq(readerSessions.userId, owner.userId), isNull(readerSessions.endedAt),
    )).returning();
    return session ?? null;
  }

  /**
   * Marks this user's session as ended without changing reading progress.
   * If it has already ended, returns it unchanged. Returns null if it does not exist.
   */
  async end(owner: ReaderOwner, id: string): Promise<ReaderSession | null> {
    const [session] = await database.update(readerSessions)
      .set({ endedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(readerSessions.id, id), eq(readerSessions.userId, owner.userId), isNull(readerSessions.endedAt)))
      .returning();
    return session ?? this.findById(owner, id);
  }
}

export const readerSessionModel = new ReaderSessionModel();
