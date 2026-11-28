import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { ReaderResourceModel, type ReaderOwner } from "../../model/readerResource.model.js";
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

describe("ReaderResourceModel", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDatabase>>["database"];
  let owner: ReaderOwner;
  let other: ReaderOwner;
  const resources = new ReaderResourceModel();
  const input = { sourceType: "url", url: "https://example.com/article", sourceDomain: "example.com", title: "Article" } as const;
  const createResource = () => resources.create(owner, input);

  beforeEach(async () => {
    ({ client, database: db } = await createTestDatabase());
    state.current = db as unknown as Record<PropertyKey, unknown>;
    const records = await db.insert(users).values(["one", "two"].map((name) => ({ email: `${name}@example.com`, password: "hash" }))).returning();
    owner = { userId: records[0]!.id };
    other = { userId: records[1]!.id };
  });
  afterEach(async () => {
    if (client) await client.close();
    state.current = undefined;
  });

  it("should create resources with defaults and enforce URL uniqueness per user", async () => {
    const resource = await createResource();
    expect(resource).toMatchObject({ ...input, userId: owner.userId, status: "not_started", lastAccessedAt: null, pdfObjectReference: null });
    expect(resource.createdAt).toBeInstanceOf(Date);
    expect(resource.updatedAt).toBeInstanceOf(Date);
    expect(await resources.findById(owner, resource.id)).toEqual(resource);
    expect(await resources.findById(owner, crypto.randomUUID())).toBeNull();
    await expect(createResource()).rejects.toMatchObject({ cause: { code: "23505", constraint: "reader_user_url_unique" } });
    expect((await resources.create(other, input)).id).not.toBe(resource.id);
  });

  it.each(["not_started", "reading", "finished"] as const)("should list only the user's %s resources, ordered by last access and creation time", async (status) => {
    const old = new Date("2025-01-01T00:00:00Z");
    const recent = new Date("2025-02-01T00:00:00Z");
    const rows = await db.insert(readerResources).values([0, 1, 2, 3].map((index) => ({
      ...input, userId: owner.userId, status, url: `${input.url}/${index}`,
      lastAccessedAt: index < 2 ? (index === 0 ? old : recent) : null, createdAt: index === 2 ? old : recent,
    }))).returning();
    await db.insert(readerResources).values({ ...input, userId: other.userId, status });
    await db.insert(readerResources).values({ ...input, userId: owner.userId, status: status === "reading" ? "finished" : "reading" });
    expect((await resources.list(owner, status)).map((row) => row.id)).toEqual([rows[1]!.id, rows[0]!.id, rows[3]!.id, rows[2]!.id]);
  });

  it("should save resource status and modification time without changing access time", async () => {
    const resource = await createResource();
    const changed = await resources.setStatus(owner, resource.id, "finished");
    expect(changed).toMatchObject({ status: "finished", lastAccessedAt: resource.lastAccessedAt });
    expect(changed!.updatedAt.getTime()).toBeGreaterThanOrEqual(resource.updatedAt.getTime());
    expect(await resources.findById(owner, resource.id)).toEqual(changed);
    expect(await resources.setStatus(owner, resource.id, "reading")).toMatchObject({ status: "reading" });
    expect(await resources.setStatus(owner, crypto.randomUUID(), "finished")).toBeNull();
  });

  it("should prevent reading or changing another user's records", async () => {
    const resource = await createResource();
    expect(await resources.findById(other, resource.id)).toBeNull();
    expect(await resources.list(other, "not_started")).toEqual([]);
    expect(await resources.setStatus(other, resource.id, "finished")).toBeNull();
    expect(await resources.delete(other, resource.id)).toBe(false);
    expect(await resources.findById(owner, resource.id)).toEqual(resource);
  });

  it("should reject resources with an unknown owner", async () => {
    await expect(db.insert(readerResources).values({ ...input, userId: crypto.randomUUID() })).rejects.toMatchObject({ cause: { code: "23503" } });
  });

  it("should store PDF placeholders without allowing an upload reference", async () => {
    const resource = await resources.create(owner, { sourceType: "pdf", title: "PDF placeholder", url: null, sourceDomain: null });
    expect(resource).toMatchObject({ status: "not_started", pdfObjectReference: null });
    await expect(db.update(readerResources).set({ pdfObjectReference: "private-key" }).where(eq(readerResources.id, resource.id)))
      .rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("should remove related records when a resource or user is deleted", async () => {
    const resource = await createResource();
    await db.insert(readerSessions).values([
      { userId: owner.userId, resourceId: resource.id, endedAt: new Date(Date.now() + 60_000) },
      { userId: owner.userId, resourceId: resource.id },
    ]);
    expect(await resources.delete(owner, resource.id)).toBe(true);
    expect(await resources.delete(owner, resource.id)).toBe(false);
    expect(await resources.findById(owner, resource.id)).toBeNull();
    expect(await db.select().from(readerSessions)).toEqual([]);
    await db.insert(readerSessions).values({ userId: owner.userId, resourceId: (await createResource()).id });
    await db.delete(users).where(eq(users.id, owner.userId));
    expect(await db.select().from(readerResources)).toEqual([]);
    expect(await db.select().from(readerSessions)).toEqual([]);
  });

  it("should reject values that violate reader_resources database constraints", async () => {
    const resource = await createResource();
    const checks = [
      ["title=''", "reader_resource_title_check"],
      ["url=NULL", "reader_resource_source_check"],
      ["pdf_object_reference='private-key'", "reader_resource_source_check"],
      ["status='invalid'", "reader_resource_status_check"],
    ];
    for (const [assignment, constraint] of checks) {
      await expect(client.query(`UPDATE reader_resources SET ${assignment} WHERE id=$1`, [resource.id])).rejects.toMatchObject({ code: "23514", constraint });
    }
  });
});
