import type { PGlite } from "@electric-sql/pglite";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderResourceModel, type ReaderOwner } from "../../model/readerResource.model.js";
import { ReaderSessionModel } from "../../model/readerSession.model.js";
import { readerResources } from "../../schema/readerResource.schema.js";
import { readerSessions } from "../../schema/readerSession.schema.js";
import { users } from "../../schema/user.schema.js";
import { createTestDatabase } from "../database/database.js";

const state = vi.hoisted(() => ({ current: undefined as Record<PropertyKey, unknown> | undefined }));
vi.mock("../../db/client.js", () => ({
  database: new Proxy({}, {
    get(_target, property) {
      if (!state.current) throw new Error("Test database has not been initialized");
      const value = Reflect.get(state.current, property, state.current) as unknown;
      return typeof value === "function" ? value.bind(state.current) : value;
    },
  }),
}));

describe("ReaderSessionModel", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDatabase>>["database"];
  let owner: ReaderOwner;
  let other: ReaderOwner;
  let failAtStatement: number | undefined;
  type Statement = { text: string; params: unknown[]; options: { arrayMode?: boolean } };
  const resources = new ReaderResourceModel();
  const sessions = new ReaderSessionModel();
  const input = { sourceType: "url", url: "https://example.com/article", sourceDomain: "example.com", title: "Article" } as const;
  const position = { progress: 45, scrollOffset: 2400, pageNumber: null } as const;
  const opening = { from: "not_started", to: "reading" } as const;
  const createResource = () => resources.create(owner, input);
  async function open(resourceId: string) {
    const visit = await sessions.open(owner, resourceId, opening);
    expect(visit).not.toBeNull();
    return visit!;
  }

  beforeEach(async () => {
    ({ client, database: db } = await createTestDatabase());
    failAtStatement = undefined;
    // Shared PGlite utilities lack batch(). Keep the real Neon Drizzle batch builder,
    // replacing only its lazy transport with actual PGlite queries/transactions.
    const transport = {
      query(text: string, params: unknown[], options: Statement["options"] = {}) {
        return { text, params, options,
          then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
            return client.query(text, params, { rowMode: options.arrayMode ? "array" : "object" }).then(resolve, reject);
          },
        };
      },
      transaction(statements: Statement[]) {
        return client.transaction(async (tx) => {
          const results = [];
          for (const [index, statement] of statements.entries()) {
            if (index === failAtStatement) throw new Error("Injected batch failure");
            results.push(await tx.query(statement.text, statement.params, { rowMode: statement.options.arrayMode ? "array" : "object" }));
          }
          return results;
        });
      },
    };
    state.current = neonDrizzle({ client: transport as unknown as NeonQueryFunction<false, false> }) as unknown as Record<PropertyKey, unknown>;
    const records = await db.insert(users).values(["one", "two"].map((name) => ({ email: `${name}@example.com`, password: "hash" }))).returning();
    owner = { userId: records[0]!.id };
    other = { userId: records[1]!.id };
  });
  afterEach(async () => {
    if (client) await client.close();
    state.current = undefined;
  });

  it("should save progress, status, failure code, and modification time for an open session", async () => {
    const resource = await createResource();
    const visit = await open(resource.id);
    const before = await resources.findById(owner, resource.id);
    expect(await sessions.setStatus(owner, visit.id, "failed", "unavailable"))
      .toMatchObject({ status: "failed", failureCode: "unavailable" });
    const progress = await sessions.updateProgress(owner, visit.id, position);
    expect(progress).toMatchObject({ ...position, status: "failed", failureCode: "unavailable" });
    expect(progress!.updatedAt.getTime()).toBeGreaterThanOrEqual(visit.updatedAt.getTime());
    const changed = await sessions.setStatus(owner, visit.id, "active");
    expect(changed).toMatchObject({ ...position, status: "active", failureCode: null });
    expect(changed!.updatedAt.getTime()).toBeGreaterThanOrEqual(progress!.updatedAt.getTime());
    expect(await sessions.findById(owner, visit.id)).toEqual(changed);
    expect(await resources.findById(owner, resource.id)).toEqual(before);
    expect(await sessions.updateProgress(owner, crypto.randomUUID(), position)).toBeNull();
    expect(await sessions.setStatus(owner, crypto.randomUUID(), "active")).toBeNull();
  });

  it("should prevent reading or changing another user's records", async () => {
    const resource = await createResource();
    const visit = await open(resource.id);
    expect(await sessions.open(other, resource.id, opening)).toBeNull();
    expect(await sessions.findById(other, visit.id)).toBeNull();
    expect(await sessions.findLatestSession(other, resource.id)).toBeNull();
    expect(await sessions.recent(other)).toEqual([]);
    expect(await sessions.updateProgress(other, visit.id, position)).toBeNull();
    expect(await sessions.setStatus(other, visit.id, "failed", "unavailable")).toBeNull();
    expect(await sessions.end(other, visit.id)).toBeNull();
    expect(await sessions.findById(owner, visit.id)).toEqual(visit);
  });

  it("should open a session with defaults and set the resource's access time to its start time", async () => {
    const resource = await createResource();
    expect(await sessions.findLatestSession(owner, resource.id)).toBeNull();
    const visit = await open(resource.id);
    expect(visit).toMatchObject({ userId: owner.userId, resourceId: resource.id, initialProgress: 0, progress: 0,
      scrollOffset: null, pageNumber: null, status: "active", failureCode: null, endedAt: null });
    expect(visit.updatedAt).toEqual(visit.createdAt);
    expect(await resources.findById(owner, resource.id)).toMatchObject({ status: "reading", lastAccessedAt: visit.createdAt });
    const exact = await client.query("SELECT r.last_accessed_at = s.created_at AS synchronized FROM reader_resources r JOIN reader_sessions s ON s.resource_id=r.id WHERE s.id=$1", [visit.id]);
    expect(exact.rows).toEqual([{ synchronized: true }]);
  });

  it.each([
    { status: "active", progress: 45, failureCode: null },
    { status: "failed", progress: 60, failureCode: "unavailable" },
    { status: "completed", progress: 100, failureCode: null },
  ] as const)("should copy the previous $status session's reading state and end that session", async (reading) => {
    const resource = await createResource();
    await db.update(readerResources).set({ status: "finished" }).where(eq(readerResources.id, resource.id));
    const first = await open(resource.id);
    await db.update(readerSessions).set({ ...position, ...reading }).where(eq(readerSessions.id, first.id));
    const second = await open(resource.id);
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ ...position, ...reading, initialProgress: reading.progress, endedAt: null });
    const history = await sessions.findById(owner, first.id);
    expect(history).toMatchObject({ ...position, ...reading, initialProgress: 0, createdAt: first.createdAt, endedAt: expect.any(Date) });
    expect(await sessions.updateProgress(owner, first.id, position)).toBeNull();
    expect(await sessions.setStatus(owner, first.id, "failed", "unavailable")).toBeNull();
    expect(await sessions.findById(owner, first.id)).toEqual(history);
    expect(await sessions.findLatestSession(owner, resource.id)).toEqual(second);
    expect((await resources.findById(owner, resource.id))?.status).toBe("finished");
    if (reading.status === "active")
      expect(await sessions.updateProgress(owner, second.id, { ...position, progress: 20 })).toMatchObject({ initialProgress: 45, progress: 20 });
  });

  it("should find the latest session when start times match and list history newest first", async () => {
    const resource = await createResource();
    const old = new Date("2025-01-01T00:00:00Z"), recent = new Date("2025-02-01T00:00:00Z");
    const ids = ["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000020"];
    await db.insert(readerSessions).values(ids.map((id) => ({ id, userId: owner.userId, resourceId: resource.id, createdAt: recent, endedAt: recent })));
    const [older] = await db.insert(readerSessions).values({ userId: owner.userId, resourceId: resource.id, createdAt: old, endedAt: old, updatedAt: new Date("2030-01-01") }).returning();
    expect((await sessions.findLatestSession(owner, resource.id))?.id).toBe(ids[1]);
    const history = await sessions.recent(owner);
    expect(history.map((row) => row.createdAt)).toEqual([recent, recent, old]);
    expect(history[2]?.id).toBe(older!.id);
  });

  it("should end a session only once without changing its progress or the resource's access time", async () => {
    const resource = await createResource();
    const visit = await open(resource.id);
    await sessions.updateProgress(owner, visit.id, position);
    const resourceBefore = await resources.findById(owner, resource.id);
    const ended = await sessions.end(owner, visit.id);
    expect(ended).toMatchObject({ ...position, status: "active", endedAt: expect.any(Date) });
    expect(await sessions.end(owner, visit.id)).toEqual(ended);
    expect(await sessions.findLatestSession(owner, resource.id)).toEqual(ended);
    expect(await resources.findById(owner, resource.id)).toEqual(resourceBefore);
    expect(await resources.setStatus(owner, resource.id, "finished")).toMatchObject({ lastAccessedAt: resourceBefore!.lastAccessedAt });
    expect(await sessions.findById(owner, visit.id)).toEqual(ended);
    expect(await sessions.end(owner, crypto.randomUUID())).toBeNull();
  });

  it.each(["pdf", "position"] as const)("should read and update owned sessions independently of source usability (%s)", async (kind) => {
    const resource = await resources.create(owner, kind === "pdf"
      ? { sourceType: "pdf", title: "PDF placeholder", url: null, sourceDomain: null } : input);
    const [visit] = await db.insert(readerSessions).values({ userId: owner.userId, resourceId: resource.id, pageNumber: 2 }).returning();
    expect(await sessions.open(owner, resource.id, opening)).toBeNull();
    expect(await sessions.findById(owner, visit!.id)).toEqual(visit);
    expect((await sessions.recent(owner)).map((row) => row.id)).toContain(visit!.id);
    const readingPosition = { ...position, pageNumber: 2, scrollOffset: null };
    expect(await sessions.updateProgress(owner, visit!.id, readingPosition)).toMatchObject(readingPosition);
    expect(await sessions.setStatus(owner, visit!.id, "failed", "unavailable"))
      .toMatchObject({ ...readingPosition, status: "failed", failureCode: "unavailable" });
    expect(await resources.findById(owner, resource.id)).toEqual(resource);
  });

  it("should reject invalid resource references and allow only one ongoing session per resource", async () => {
    const resource = await createResource();
    for (const values of [{ userId: other.userId, resourceId: resource.id }, { userId: owner.userId, resourceId: crypto.randomUUID() }]) {
      await expect(db.insert(readerSessions).values(values)).rejects.toMatchObject({ cause: { code: "23503" } });
    }
    const visit = await open(resource.id);
    await expect(db.insert(readerSessions).values({ userId: owner.userId, resourceId: resource.id })).rejects.toMatchObject({ cause: { code: "23505" } });
    await sessions.end(owner, visit.id);
    expect((await open(resource.id)).id).not.toBe(visit.id);
  });

  it("should reject values that violate reader_sessions database constraints", async () => {
    const resource = await createResource();
    const visit = await open(resource.id);
    const checks = [
      ["initial_progress=101", "reader_session_initial_progress_check"],
      ["progress=101", "reader_session_progress_check"],
      ["status='paused'", "reader_session_status_check"],
      ["ended_at='2000-01-01T00:00:00Z'", "reader_session_end_check"],
      ["status='completed'", "reader_session_progress_check"],
      ["scroll_offset=1,page_number=1", "reader_session_position_check"],
      ["page_number=0", "reader_session_position_check"],
      ["status='failed',failure_code='raw-error'", "reader_session_failure_check"],
    ];
    for (const [assignment, constraint] of checks) {
      await expect(client.query(`UPDATE reader_sessions SET ${assignment} WHERE id=$1`, [visit.id])).rejects.toMatchObject({ code: "23514", constraint });
    }
  });

  it("should propagate database constraint errors when updating a session", async () => {
    const resource = await createResource();
    const visit = await open(resource.id);
    await expect(sessions.updateProgress(owner, visit.id, { ...position, progress: 101 }))
      .rejects.toMatchObject({ cause: { code: "23514", constraint: "reader_session_progress_check" } });
    await expect(sessions.setStatus(owner, visit.id, "failed"))
      .rejects.toMatchObject({ cause: { code: "23514", constraint: "reader_session_failure_check" } });
    expect(await sessions.findById(owner, visit.id)).toEqual(visit);
  });

  it("should undo all session-opening changes when the transaction fails", async () => {
    const resource = await createResource();
    const first = await open(resource.id);
    await sessions.updateProgress(owner, first.id, position);
    const historyBefore = await db.select().from(readerSessions);
    const resourceBefore = await resources.findById(owner, resource.id);
    failAtStatement = 3;
    await expect(sessions.open(owner, resource.id, opening)).rejects.toThrow("Injected batch failure");
    expect(await db.select().from(readerSessions)).toEqual(historyBefore);
    expect(await resources.findById(owner, resource.id)).toEqual(resourceBefore);
  });

  // PGlite serializes transactions: these are integration checks, not proof of
  // production PostgreSQL concurrency safety across independent connections.
  it.each([false, true])("should preserve progress and allow only one ongoing session when requests overlap (progress first: %s)", async (progressFirst) => {
    const resource = await createResource();
    const first = await open(resource.id);
    await sessions.updateProgress(owner, first.id, position);
    const opened = await Promise.all([open(resource.id), open(resource.id)]);
    expect(new Set(opened.map((row) => row.id)).size).toBe(2);
    expect(opened.every((row) => row.initialProgress === 45 && row.progress === 45)).toBe(true);
    const previous = (await sessions.findLatestSession(owner, resource.id))!;
    await Promise.all(progressFirst
      ? [sessions.updateProgress(owner, previous.id, { ...position, progress: 60 }), open(resource.id)]
      : [open(resource.id), sessions.updateProgress(owner, previous.id, { ...position, progress: 60 })]);
    const ended = await sessions.findById(owner, previous.id);
    const latest = await sessions.findLatestSession(owner, resource.id);
    expect(ended?.endedAt).toBeInstanceOf(Date);
    expect(latest).toMatchObject({ initialProgress: ended!.progress, progress: ended!.progress, scrollOffset: ended!.scrollOffset });
    expect(await db.select().from(readerSessions).where(and(eq(readerSessions.resourceId, resource.id), isNull(readerSessions.endedAt)))).toHaveLength(1);
    expect(await db.select().from(readerSessions)).toHaveLength(4);
    expect((await resources.findById(owner, resource.id))?.lastAccessedAt).toEqual(latest?.createdAt);
  });
});
