import { NeonDbError } from "@neondatabase/serverless";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, HttpStatus } from "../../errors/appError.js";
import { ReaderResourceService, readerResourceService } from "../../service/readerResource.service.js";
import type { ReaderResource } from "../../schema/readerResource.schema.js";

const mocks = vi.hoisted(() => ({
  readerResourceModel: {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    setStatus: vi.fn(),
  },
}));

vi.mock("../../model/readerResource.model.js", () => ({ readerResourceModel: mocks.readerResourceModel }));

function databaseError(code: string, constraint: string): NeonDbError {
  return Object.assign(Object.create(NeonDbError.prototype) as NeonDbError, { code, constraint });
}

describe("ReaderResourceService", () => {
  const userId = "00000000-0000-4000-8000-000000000001";
  const owner = { userId };
  const input = { url: "https://example.com/article", title: "Article" };
  const resource: ReaderResource = {
    id: "00000000-0000-4000-8000-000000000002",
    userId, sourceType: "url", ...input, sourceDomain: "example.com",
    pdfObjectReference: null, status: "not_started", lastAccessedAt: null,
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  };
  let service: ReaderResourceService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ReaderResourceService();
    mocks.readerResourceModel.create.mockResolvedValue(resource);
  });

  it("should export a service instance and return the created resource", async () => {
    expect(readerResourceService).toBeInstanceOf(ReaderResourceService);
    await expect(service.create(userId, input)).resolves.toBe(resource);
  });

  it.each([
    ["HTTPS://EXAMPLE.COM:443/article#section", "https://example.com/article", "example.com"],
    ["HTTP://EXAMPLE.COM:80", "http://example.com/", "example.com"],
    ["https://Sub.Example.com:8443/a", "https://sub.example.com:8443/a", "sub.example.com"],
    ["https://例え.jp/article", "https://xn--r8jz45g.jp/article", "xn--r8jz45g.jp"],
  ])("should normalize %s and derive its source domain", async (original, url, sourceDomain) => {
    await service.create(userId, { url: original, title: "  Article  " });
    expect(mocks.readerResourceModel.create).toHaveBeenCalledExactlyOnceWith(owner, {
      sourceType: "url", url, sourceDomain, title: "Article",
    });
  });

  it.each([
    ["http://example.com/a", "https://example.com/a"],
    ["https://example.com/a", "https://example.com/a/"],
    ["https://example.com/a?q=1", "https://example.com/a?q=2"],
    ["https://example.com/a?a=1&b=2", "https://example.com/a?b=2&a=1"],
    ["https://example.com/a?a=1", "https://example.com/a?a=1&a=2"],
    ["https://example.com/a", "https://example.com:8443/a"],
    ["https://example.com/A", "https://example.com/a"],
  ])("should preserve the difference between %s and %s", async (first, second) => {
    await service.create(userId, { ...input, url: first });
    await service.create(userId, { ...input, url: second });
    expect(mocks.readerResourceModel.create.mock.calls.map((call) => call[1].url)).toEqual([first, second]);
  });

  it.each([
    "", "not a URL", "/article", "https://", "https://exa mple.com/", "https://example.com:99999/",
    "ftp://example.com/article", "file:///article", "javascript:alert(1)",
    "https://user:secret@example.com/", "https://user@example.com/", "https://:secret@example.com/",
    "https://us%65r@example.com/", null, undefined, 123,
  ])("should reject an invalid or credential-bearing URL: %s", async (url) => {
    const result = service.create(userId, { ...input, url: url as string });
    await expect(result).rejects.toBeInstanceOf(AppError);
    await expect(result).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.readerResourceModel.create).not.toHaveBeenCalled();
  });

  it("should preserve query values containing URL-like text", async () => {
    const url = "https://example.com/article?next=https://user@example.org/a#fragment";
    await service.create(userId, { ...input, url });
    expect(mocks.readerResourceModel.create).toHaveBeenCalledWith(owner, expect.objectContaining({
      url: "https://example.com/article?next=https://user@example.org/a", sourceDomain: "example.com",
    }));
  });

  it.each(["", "   ", "\t\n", null, undefined, 123])("should reject an invalid title: %s", async (title) => {
    await expect(service.create(userId, { ...input, title: title as string })).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    });
    expect(mocks.readerResourceModel.create).not.toHaveBeenCalled();
  });

  it("should allow nonempty titles without adding a length restriction", async () => {
    const title = "Article".repeat(1000);
    await service.create(userId, { ...input, title });
    expect(mocks.readerResourceModel.create).toHaveBeenCalledWith(owner, expect.objectContaining({ title }));
  });

  it.each([false, true])("should translate a URL uniqueness violation to 409 (wrapped: %s)", async (wrapped) => {
    const cause = databaseError("23505", "reader_user_url_unique");
    mocks.readerResourceModel.create.mockRejectedValue(wrapped ? new DrizzleQueryError("insert", [], cause) : cause);
    await expect(service.create(userId, input)).rejects.toMatchObject({
      name: "AppError", statusCode: HttpStatus.CONFLICT, message: "Reader resource already exists",
    });
  });

  it.each([
    new Error("Database unavailable"),
    databaseError("23505", "unrelated_constraint"),
    new DrizzleQueryError("insert", [], databaseError("23503", "reader_resources_user_id_users_id_fk")),
  ])("should propagate unrelated creation errors", async (error) => {
    mocks.readerResourceModel.create.mockRejectedValue(error);
    await expect(service.create(userId, input)).rejects.toBe(error);
  });

  it("should retrieve a resource using the authenticated owner's ID", async () => {
    mocks.readerResourceModel.findById.mockResolvedValue(resource);
    await expect(service.findById(userId, resource.id)).resolves.toBe(resource);
    expect(mocks.readerResourceModel.findById).toHaveBeenCalledExactlyOnceWith(owner, resource.id);
  });

  it.each(["missing-resource", "another-users-resource"])("should return the same 404 for %s", async (id) => {
    mocks.readerResourceModel.findById.mockResolvedValue(null);
    mocks.readerResourceModel.delete.mockResolvedValue(false);
    for (const result of [service.findById(userId, id), service.delete(userId, id), service.setStatus(userId, id, "reading")]) {
      await expect(result).rejects.toMatchObject({ statusCode: HttpStatus.NOT_FOUND, message: "Reader resource not found" });
    }
    expect(mocks.readerResourceModel.findById).toHaveBeenCalledWith(owner, id);
    expect(mocks.readerResourceModel.delete).toHaveBeenCalledWith(owner, id);
    expect(mocks.readerResourceModel.setStatus).not.toHaveBeenCalled();
  });

  it.each(["not_started", "reading", "finished"])("should list resources with status %s", async (status) => {
    const resources = [{ ...resource, status }];
    mocks.readerResourceModel.list.mockResolvedValue(resources);
    await expect(service.list(userId, status)).resolves.toBe(resources);
    expect(mocks.readerResourceModel.list).toHaveBeenCalledExactlyOnceWith(owner, status);
  });

  it.each(["", "invalid", "READING"])("should reject invalid status %s before querying the model", async (status) => {
    await expect(service.list(userId, status)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    await expect(service.setStatus(userId, resource.id, status)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.readerResourceModel.list).not.toHaveBeenCalled();
    expect(mocks.readerResourceModel.findById).not.toHaveBeenCalled();
    expect(mocks.readerResourceModel.setStatus).not.toHaveBeenCalled();
  });

  it("should delegate deletion to the model and return success", async () => {
    mocks.readerResourceModel.delete.mockResolvedValue(true);
    await expect(service.delete(userId, resource.id)).resolves.toBe(true);
    expect(mocks.readerResourceModel.delete).toHaveBeenCalledExactlyOnceWith(owner, resource.id);
  });

  it.each([
    ["reading", "finished"], ["finished", "reading"],
  ] as const)("should allow a manual change from %s to %s", async (from, to) => {
    const updated = { ...resource, status: to };
    mocks.readerResourceModel.findById.mockResolvedValue({ ...resource, status: from });
    mocks.readerResourceModel.setStatus.mockResolvedValue(updated);
    await expect(service.setStatus(userId, resource.id, to)).resolves.toBe(updated);
    expect(mocks.readerResourceModel.setStatus).toHaveBeenCalledExactlyOnceWith(owner, resource.id, to);
  });

  it.each([
    ["not_started", "reading"], ["not_started", "finished"], ["not_started", "not_started"],
    ["reading", "not_started"], ["finished", "not_started"], ["reading", "reading"], ["finished", "finished"],
  ] as const)("should reject a manual change from %s to %s", async (from, to) => {
    mocks.readerResourceModel.findById.mockResolvedValue({ ...resource, status: from });
    await expect(service.setStatus(userId, resource.id, to)).rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(mocks.readerResourceModel.setStatus).not.toHaveBeenCalled();
  });

  it("should return 404 when the resource disappears before its status is updated", async () => {
    mocks.readerResourceModel.findById.mockResolvedValue({ ...resource, status: "reading" });
    mocks.readerResourceModel.setStatus.mockResolvedValue(null);
    await expect(service.setStatus(userId, resource.id, "finished")).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND, message: "Reader resource not found",
    });
  });
});
