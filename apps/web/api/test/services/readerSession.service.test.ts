import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, HttpStatus } from "../../errors/appError.js";
import type { ReaderProgressInput } from "../../model/readerSession.model.js";
import type { ReaderResource } from "../../schema/readerResource.schema.js";
import type { ReaderSession } from "../../schema/readerSession.schema.js";
import { ReaderSessionService, readerSessionService } from "../../service/readerSession.service.js";

const mocks = vi.hoisted(() => ({
  resources: { findById: vi.fn(), setStatus: vi.fn() },
  sessions: {
    open: vi.fn(), findById: vi.fn(), findLatestSession: vi.fn(), recent: vi.fn(),
    updateProgress: vi.fn(), setStatus: vi.fn(), end: vi.fn(),
  },
}));

vi.mock("../../model/readerResource.model.js", () => ({ readerResourceModel: mocks.resources }));
vi.mock("../../model/readerSession.model.js", () => ({ readerSessionModel: mocks.sessions }));

describe("ReaderSessionService", () => {
  const userId = "00000000-0000-4000-8000-000000000001";
  const owner = { userId };
  const resource: ReaderResource = {
    id: "00000000-0000-4000-8000-000000000002", userId,
    sourceType: "url", url: "https://example.com/article", title: "Article", sourceDomain: "example.com",
    pdfObjectReference: null, status: "not_started", lastAccessedAt: null,
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  };
  const session: ReaderSession = {
    id: "00000000-0000-4000-8000-000000000003", userId, resourceId: resource.id,
    initialProgress: 0, progress: 40, scrollOffset: 100, pageNumber: null,
    status: "active", failureCode: null, endedAt: null,
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  };
  const position: ReaderProgressInput = { progress: 60, scrollOffset: 200, pageNumber: null };
  let service: ReaderSessionService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ReaderSessionService();
    mocks.resources.findById.mockResolvedValue(resource);
    mocks.sessions.findById.mockResolvedValue(session);
    mocks.sessions.open.mockResolvedValue(session);
  });

  afterEach(() => {
    expect(mocks.resources.setStatus).not.toHaveBeenCalled();
  });

  it.each(["not_started", "reading", "finished"] as const)("should delegate opening a %s resource to the atomic model operation", async (status) => {
    expect(readerSessionService).toBeInstanceOf(ReaderSessionService);
    mocks.resources.findById.mockResolvedValue({ ...resource, status });
    await expect(service.open(userId, resource.id)).resolves.toBe(session);
    expect(mocks.resources.findById).toHaveBeenCalledExactlyOnceWith(owner, resource.id);
    expect(mocks.sessions.open).toHaveBeenCalledExactlyOnceWith(owner, resource.id,
      status === "not_started" ? { from: "not_started", to: "reading" } : null);
    expect(mocks.sessions.end).not.toHaveBeenCalled();
    expect(mocks.sessions.findLatestSession).not.toHaveBeenCalled();
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each([
    { sourceType: "pdf", url: null }, { sourceType: "url", url: null }, { sourceType: "url", url: "" },
  ])("should reject opening an unsupported or unusable source: $sourceType/$url", async (source) => {
    mocks.resources.findById.mockResolvedValue({ ...resource, ...source });
    await expect(service.open(userId, resource.id)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.open).not.toHaveBeenCalled();
  });

  it.each([userId, "another-user"])("should return the same resource-not-found error for an owner-scoped miss (%s)", async (authenticatedUser) => {
    mocks.resources.findById.mockResolvedValue(null);
    for (const invoke of [
      () => service.open(authenticatedUser, resource.id),
      () => service.findLatestSession(authenticatedUser, resource.id),
      () => service.updateProgress(authenticatedUser, session.id, position),
    ]) {
      await expect(invoke()).rejects.toMatchObject({ statusCode: HttpStatus.NOT_FOUND, message: "Reader resource not found" });
    }
    expect(mocks.resources.findById).toHaveBeenCalledWith({ userId: authenticatedUser }, resource.id);
    expect(mocks.sessions.open).not.toHaveBeenCalled();
    expect(mocks.sessions.findLatestSession).not.toHaveBeenCalled();
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
  });

  it("should return an owned session directly", async () => {
    await expect(service.findById(userId, session.id)).resolves.toBe(session);
    expect(mocks.sessions.findById).toHaveBeenCalledExactlyOnceWith(owner, session.id);
  });

  it.each([session, null])("should return the latest session or null for an existing resource", async (latest) => {
    mocks.sessions.findLatestSession.mockResolvedValue(latest);
    await expect(service.findLatestSession(userId, resource.id)).resolves.toBe(latest);
    expect(mocks.resources.findById).toHaveBeenCalledExactlyOnceWith(owner, resource.id);
    expect(mocks.sessions.findLatestSession).toHaveBeenCalledExactlyOnceWith(owner, resource.id);
  });

  it("should return recent sessions without filtering or changing their structure", async () => {
    const history = [session, { ...session, id: "ended-session", status: "failed", endedAt: new Date() }];
    mocks.sessions.recent.mockResolvedValue(history);
    await expect(service.recent(userId)).resolves.toBe(history);
    expect(mocks.sessions.recent).toHaveBeenCalledExactlyOnceWith(owner);
    expect(mocks.resources.findById).not.toHaveBeenCalled();
  });

  it.each([userId, "another-user"])("should return the same session-not-found error for an owner-scoped miss (%s)", async (authenticatedUser) => {
    mocks.sessions.findById.mockResolvedValue(null);
    mocks.sessions.end.mockResolvedValue(null);
    for (const invoke of [
      () => service.findById(authenticatedUser, session.id),
      () => service.updateProgress(authenticatedUser, session.id, position),
      () => service.setStatus(authenticatedUser, session.id, "failed", "unavailable"),
      () => service.end(authenticatedUser, session.id),
    ]) {
      await expect(invoke()).rejects.toMatchObject({ statusCode: HttpStatus.NOT_FOUND, message: "Reader session not found" });
    }
    expect(mocks.sessions.findById).toHaveBeenCalledWith({ userId: authenticatedUser }, session.id);
    expect(mocks.sessions.end).toHaveBeenCalledWith({ userId: authenticatedUser }, session.id);
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each([
    { sourceType: "url", status: "active", progress: 0, scrollOffset: 0, pageNumber: null },
    { sourceType: "url", status: "active", progress: 100, scrollOffset: 2_147_483_647, pageNumber: null },
    { sourceType: "url", status: "failed", progress: 20, scrollOffset: null, pageNumber: null },
    { sourceType: "url", status: "completed", progress: 100, scrollOffset: 200, pageNumber: null },
    { sourceType: "pdf", status: "active", progress: 60, scrollOffset: null, pageNumber: 1 },
    { sourceType: "pdf", status: "active", progress: 70, scrollOffset: null, pageNumber: 2_147_483_647 },
  ] as const)("should save valid $sourceType progress without changing $status status", async ({ sourceType, status, ...input }) => {
    mocks.resources.findById.mockResolvedValue({ ...resource, sourceType,
      url: sourceType === "pdf" ? null : resource.url, sourceDomain: sourceType === "pdf" ? null : resource.sourceDomain });
    const current = { ...session, status, progress: status === "completed" ? 100 : 40,
      failureCode: status === "failed" ? "unavailable" : null };
    mocks.sessions.findById.mockResolvedValue(current);
    const updated = { ...current, ...input };
    mocks.sessions.updateProgress.mockResolvedValue(updated);
    await expect(service.updateProgress(userId, session.id, input)).resolves.toBe(updated);
    expect(mocks.resources.findById).toHaveBeenCalledExactlyOnceWith(owner, session.resourceId);
    expect(mocks.sessions.updateProgress).toHaveBeenCalledExactlyOnceWith(owner, session.id, input);
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["progress", -1], ["progress", 101], ["progress", 0.5], ["progress", NaN], ["progress", Infinity], ["progress", "40"], ["progress", null],
    ["scrollOffset", -1], ["scrollOffset", 0.5], ["scrollOffset", undefined], ["scrollOffset", 2_147_483_648],
    ["pageNumber", 0], ["pageNumber", -1], ["pageNumber", 1.5], ["pageNumber", undefined], ["pageNumber", 2_147_483_648],
  ])("should reject invalid %s value %s", async (field, value) => {
    const input = { ...position, [field as string]: value } as ReaderProgressInput;
    await expect(service.updateProgress(userId, session.id, input)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
  });

  it.each([
    ["url", 1, 1], ["url", null, 1], ["pdf", 0, null],
  ] as const)("should reject conflicting or source-incompatible positions (%s, %s, %s)", async (sourceType, scrollOffset, pageNumber) => {
    mocks.resources.findById.mockResolvedValue({ ...resource, sourceType });
    await expect(service.updateProgress(userId, session.id, { ...position, scrollOffset, pageNumber }))
      .rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
  });

  it("should reject progress below 100 for a completed session", async () => {
    mocks.sessions.findById.mockResolvedValue({ ...session, status: "completed", progress: 100 });
    await expect(service.updateProgress(userId, session.id, position)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
  });

  it("should reject progress and status changes to ended sessions", async () => {
    mocks.sessions.findById.mockResolvedValue({ ...session, endedAt: new Date() });
    await expect(service.updateProgress(userId, session.id, position)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    await expect(service.setStatus(userId, session.id, "failed", "unavailable")).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["active", "completed"], ["completed", "active"], ["failed", "active"],
  ] as const)("should allow %s to %s and keep failure code null", async (from, to) => {
    mocks.sessions.findById.mockResolvedValue({ ...session, status: from, progress: 100, failureCode: from === "failed" ? "expired" : null });
    const updated = { ...session, status: to, progress: 100 };
    mocks.sessions.setStatus.mockResolvedValue(updated);
    await expect(service.setStatus(userId, session.id, to)).resolves.toBe(updated);
    expect(mocks.sessions.setStatus).toHaveBeenCalledExactlyOnceWith(owner, session.id, to, null);
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
  });

  it.each(["unavailable", "expired", "unsupported"])("should allow active to failed with code %s", async (code) => {
    const updated = { ...session, status: "failed", failureCode: code };
    mocks.sessions.setStatus.mockResolvedValue(updated);
    await expect(service.setStatus(userId, session.id, "failed", code)).resolves.toBe(updated);
    expect(mocks.sessions.setStatus).toHaveBeenCalledExactlyOnceWith(owner, session.id, "failed", code);
  });

  it.each([
    ["active", "active"], ["completed", "completed"], ["failed", "failed"], ["completed", "failed"], ["failed", "completed"],
  ] as const)("should reject %s to %s", async (from, to) => {
    mocks.sessions.findById.mockResolvedValue({ ...session, status: from, progress: 100 });
    await expect(service.setStatus(userId, session.id, to, to === "failed" ? "unavailable" : null))
      .rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each(["paused", "", "invalid"])("should reject unknown status %s", async (status) => {
    await expect(service.setStatus(userId, session.id, status)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each([0, 99])("should require progress 100 before completion (current: %s)", async (progress) => {
    mocks.sessions.findById.mockResolvedValue({ ...session, progress });
    await expect(service.setStatus(userId, session.id, "completed")).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each([null, "", "raw-error", "UNAVAILABLE"])("should reject invalid failure code %s", async (code) => {
    await expect(service.setStatus(userId, session.id, "failed", code)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it.each(["active", "completed"])("should reject a failure code for non-failed status %s", async (status) => {
    mocks.sessions.findById.mockResolvedValue({ ...session, status: status === "active" ? "failed" : "active", progress: 100 });
    await expect(service.setStatus(userId, session.id, status, "unavailable")).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  it("should delegate ending repeatedly without modifying progress or status", async () => {
    const ended = { ...session, endedAt: new Date() };
    mocks.sessions.end.mockResolvedValue(ended);
    await expect(service.end(userId, session.id)).resolves.toBe(ended);
    await expect(service.end(userId, session.id)).resolves.toBe(ended);
    expect(mocks.sessions.end).toHaveBeenNthCalledWith(1, owner, session.id);
    expect(mocks.sessions.end).toHaveBeenNthCalledWith(2, owner, session.id);
    expect(mocks.sessions.findById).not.toHaveBeenCalled();
    expect(mocks.sessions.updateProgress).not.toHaveBeenCalled();
    expect(mocks.sessions.setStatus).not.toHaveBeenCalled();
  });

  const operations = [
    ["open", () => service.open(userId, resource.id)],
    ["findById", () => service.findById(userId, session.id)],
    ["findLatestSession", () => service.findLatestSession(userId, resource.id)],
    ["recent", () => service.recent(userId)],
    ["updateProgress", () => service.updateProgress(userId, session.id, position)],
    ["setStatus", () => service.setStatus(userId, session.id, "failed", "unavailable")],
    ["end", () => service.end(userId, session.id)],
  ] as const;

  it.each(operations.filter(([method]) => ["open", "updateProgress", "setStatus"].includes(method)))("should report unsuccessful %s operations", async (method, invoke) => {
    mocks.sessions[method].mockResolvedValue(null);
    const result = invoke();
    await expect(result).rejects.toBeInstanceOf(AppError);
    await expect(result).rejects.toMatchObject({ statusCode: HttpStatus.CONFLICT });
  });

  it.each(operations)("should propagate unexpected database errors from %s", async (method, invoke) => {
    const error = new Error("Database unavailable");
    mocks.sessions[method].mockRejectedValue(error);
    await expect(invoke()).rejects.toBe(error);
  });

  it("should propagate unexpected errors while retrieving the resource", async () => {
    const error = new Error("Database unavailable");
    mocks.resources.findById.mockRejectedValue(error);
    await expect(service.open(userId, resource.id)).rejects.toBe(error);
    expect(mocks.sessions.open).not.toHaveBeenCalled();
  });
});
