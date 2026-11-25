import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, HttpStatus } from "../../errors/appError.js";
import type { S3Storage } from "../../storage/s3.storage.js";

import {
  PHOTO_MAX_SIZE_BYTES,
  PHOTO_READ_TTL_SECONDS,
  PHOTO_UPLOAD_TTL_SECONDS,
  UploadService,
} from "../../service/upload.service.js";

describe("UploadService", () => {
  // Freeze time so upload expiry checks do not depend on when the suite runs.
  const now = new Date("2026-01-01T00:00:00.000Z");
  let storage: S3Storage;
  let service: UploadService;
  let png: Buffer;
  const ownerId = "user-id";
  const uploadId = "00000000-0000-4000-8000-000000000001";
  const pendingKey = `pending/profile/${ownerId}/${uploadId}`;
  const publishKey = `photos/profile/${ownerId}`;
  const expiresAt = new Date(now.getTime() + PHOTO_UPLOAD_TTL_SECONDS * 1000);

  function uploadedPhoto(contentType = "image/png", declaredSizeBytes = png.length) {
    return {
      contentType,
      sizeBytes: declaredSizeBytes,
      metadata: {
        "declared-size": String(declaredSizeBytes),
        "upload-expires-at": String(expiresAt.getTime()),
      },
    };
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    vi.stubEnv("AWS_REGION", "us-east-2");
    vi.stubEnv("S3_PHOTO_BUCKET", "quiescent-photos-test");
    // Use real encoded image bytes; header-only fixtures would not exercise decoding.
    png = await sharp({
      create: { width: 2, height: 3, channels: 3, background: "red" },
    }).png().toBuffer();
    storage = {
      createUploadTarget: vi.fn().mockResolvedValue({ url: "https://s3.example/upload", fields: {} }),
      inspect: vi.fn().mockResolvedValue(uploadedPhoto()),
      read: vi.fn().mockResolvedValue(png),
      copy: vi.fn().mockResolvedValue(undefined),
      createReadUrl: vi.fn().mockResolvedValue("https://s3.example/read"),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    service = new UploadService();
    (service as unknown as { storage: S3Storage }).storage = storage;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("requires a configured AWS region and photo bucket", async () => {
    vi.stubEnv("AWS_REGION", "");
    const unconfiguredService = new UploadService();
    await expect(unconfiguredService.prepareUpload("user-id", {
      contentType: "image/png", sizeBytes: 1,
    })).rejects.toThrow("AWS_REGION and S3_PHOTO_BUCKET");

    vi.stubEnv("AWS_REGION", "us-east-2");
    vi.stubEnv("S3_PHOTO_BUCKET", "");
    await expect(new UploadService().prepareUpload("user-id", {
      contentType: "image/png", sizeBytes: 1,
    })).rejects.toThrow("AWS_REGION and S3_PHOTO_BUCKET");
  });

  it("prepares a bounded upload with a generated key", async () => {
    const result = await service.prepareUpload("user-id", {
      contentType: "image/png",
      sizeBytes: png.length,
    });

    expect(result.pending.ownerId).toBe("user-id");
    expect(result.pending.pendingKey).toBe(`pending/profile/user-id/${result.pending.id}`);
    expect(result.pending.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.target.expiresAt).toEqual(expiresAt);
    expect(storage.createUploadTarget).toHaveBeenCalledWith(
      result.pending.pendingKey, "image/png", PHOTO_MAX_SIZE_BYTES, PHOTO_UPLOAD_TTL_SECONDS,
      { "declared-size": String(png.length), "upload-expires-at": String(expiresAt.getTime()) },
    );
  });

  it.each(["image/gif", "application/pdf", "text/html", ""])("rejects unsupported type %s", async (contentType) => {
    await expect(service.prepareUpload("user-id", { contentType, sizeBytes: 100 }))
      .rejects.toMatchObject({
        statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      } satisfies Partial<AppError>);
    expect(storage.createUploadTarget).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, PHOTO_MAX_SIZE_BYTES + 1, Number.NaN])(
    "rejects invalid declared size %s", async (sizeBytes) => {
      await expect(service.prepareUpload("user-id", { contentType: "image/png", sizeBytes }))
        .rejects.toMatchObject({ statusCode: HttpStatus.BAD_REQUEST } satisfies Partial<AppError>);
    },
  );

  it("validates a staged copy before publishing the profile image", async () => {
    await expect(service.completeUpload(ownerId, uploadId)).resolves.toEqual({ id: uploadId });

    const stagedKey = vi.mocked(storage.copy).mock.calls[0]?.[1];
    expect(stagedKey).toMatch(/^pending\/validated\/[0-9a-f-]{36}$/);
    expect(storage.inspect).toHaveBeenCalledTimes(2);
    expect(storage.inspect).toHaveBeenNthCalledWith(1, pendingKey);
    expect(storage.inspect).toHaveBeenNthCalledWith(2, stagedKey);
    expect(storage.copy).toHaveBeenNthCalledWith(1, pendingKey, stagedKey);
    expect(storage.read).toHaveBeenCalledWith(stagedKey, PHOTO_MAX_SIZE_BYTES);
    expect(storage.copy).toHaveBeenNthCalledWith(2, stagedKey, publishKey);
    expect(storage.delete).toHaveBeenCalledWith(stagedKey);
    expect(storage.delete).toHaveBeenCalledWith(pendingKey);
  });

  it.each([
    { contentType: "image/jpeg" as const, format: "jpeg" as const },
    { contentType: "image/webp" as const, format: "webp" as const },
  ])("accepts decoded $contentType bytes", async ({ contentType, format }) => {
    const bytes = await sharp(png).toFormat(format).toBuffer();
    vi.mocked(storage.inspect).mockResolvedValue(uploadedPhoto(contentType, bytes.length));
    vi.mocked(storage.read).mockResolvedValue(bytes);

    await expect(service.completeUpload(ownerId, uploadId)).resolves.toEqual({ id: uploadId });
  });

  it("rejects an expired upload before copying", async () => {
    vi.setSystemTime(expiresAt);
    await expect(service.completeUpload(ownerId, uploadId)).rejects.toMatchObject({ statusCode: HttpStatus.NOT_FOUND });
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("rejects missing and mismatched pending objects before copying", async () => {
    vi.mocked(storage.inspect).mockResolvedValueOnce(null);
    await expect(service.completeUpload(ownerId, uploadId)).rejects.toMatchObject({ statusCode: HttpStatus.NOT_FOUND });
    vi.mocked(storage.inspect).mockResolvedValueOnce({ ...uploadedPhoto(), sizeBytes: png.length + 1 });
    await expect(service.completeUpload(ownerId, uploadId)).rejects.toThrow("size does not match");
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("rejects a copied object whose size changes and removes it", async () => {
    // The first HEAD sees the pending upload; the second sees the staged copy.
    vi.mocked(storage.inspect)
      .mockResolvedValueOnce(uploadedPhoto())
      .mockResolvedValueOnce({ sizeBytes: png.length + 1 });
    await expect(service.completeUpload(ownerId, uploadId)).rejects.toThrow("Copied photo size");
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^pending\/validated\//));
  });

  it("rejects a different image type even when it decodes", async () => {
    const jpeg = await sharp(png).jpeg().toBuffer();
    vi.mocked(storage.inspect).mockResolvedValue(uploadedPhoto("image/png", jpeg.length));
    vi.mocked(storage.read).mockResolvedValue(jpeg);

    await expect(service.completeUpload(ownerId, uploadId)).rejects.toThrow("declared photo type");
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^pending\/validated\//));
  });

  it("rejects corrupt image bytes and removes the staged copy", async () => {
    const corrupt = Buffer.alloc(png.length, 0);
    vi.mocked(storage.read).mockResolvedValue(corrupt);
    await expect(service.completeUpload(ownerId, uploadId)).rejects.toThrow("invalid");
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^pending\/validated\//));
  });

  it("reports a cleanup failure after validation failure", async () => {
    // The final copy cannot be published when validation and its cleanup both fail.
    vi.mocked(storage.read).mockResolvedValue(Buffer.alloc(png.length));
    vi.mocked(storage.delete).mockRejectedValue(new Error("S3 unavailable"));
    await expect(service.completeUpload(ownerId, uploadId)).rejects.toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Photo storage failed",
    } satisfies Partial<AppError>);
  });

  it("keeps a valid photo ready when pending-key deletion needs later cleanup", async () => {
    // A leftover pending key cannot change the already validated final copy.
    vi.mocked(storage.delete).mockRejectedValue(new Error("S3 unavailable"));
    await expect(service.completeUpload(ownerId, uploadId)).resolves.toEqual({ id: uploadId });
  });

  it("issues a short-lived read URL and deletes the owner's profile image", async () => {
    await expect(service.getProfileImage(ownerId)).resolves.toEqual({ url: "https://s3.example/read" });
    expect(storage.createReadUrl).toHaveBeenCalledWith(publishKey, PHOTO_READ_TTL_SECONDS);
    await service.deleteProfileImage(ownerId);
    expect(storage.delete).toHaveBeenCalledWith(publishKey);
  });
});
