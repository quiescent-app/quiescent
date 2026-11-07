import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PHOTO_MAX_SIZE_BYTES,
  PHOTO_READ_TTL_SECONDS,
  PHOTO_UPLOAD_TTL_SECONDS,
  PhotoStorageError,
  PhotoValidationError,
  UploadService,
  type PendingPhotoUpload,
  type PhotoStorage,
  type ReadyPhoto,
} from "../../service/upload.service.js";

describe("UploadService", () => {
  // Freeze time so upload expiry checks do not depend on when the suite runs.
  const now = new Date("2026-01-01T00:00:00.000Z");
  let storage: PhotoStorage;
  let service: UploadService;
  let png: Buffer;
  let pending: PendingPhotoUpload;

  beforeEach(async () => {
    // Use real encoded image bytes; header-only fixtures would not exercise decoding.
    png = await sharp({
      create: { width: 2, height: 3, channels: 3, background: "red" },
    }).png().toBuffer();
    storage = {
      createUploadTarget: vi.fn().mockResolvedValue({ url: "https://s3.example/upload", fields: {} }),
      inspect: vi.fn().mockResolvedValue({ sizeBytes: png.length }),
      read: vi.fn().mockResolvedValue(png),
      copy: vi.fn().mockResolvedValue(undefined),
      createReadUrl: vi.fn().mockResolvedValue("https://s3.example/read"),
      delete: vi.fn().mockResolvedValue(undefined),
    } as PhotoStorage;
    service = new UploadService(storage, () => now);
    pending = {
      id: "upload-id",
      ownerId: "user-id",
      pendingKey: "pending/upload-id",
      contentType: "image/png",
      declaredSizeBytes: png.length,
      expiresAt: new Date(now.getTime() + PHOTO_UPLOAD_TTL_SECONDS * 1000),
    };
  });

  it("prepares a bounded upload with a generated key", async () => {
    const result = await service.prepareUpload("user-id", {
      contentType: "image/png",
      sizeBytes: png.length,
    });

    expect(result.pending.ownerId).toBe("user-id");
    expect(result.pending.pendingKey).toMatch(/^pending\/[0-9a-f-]{36}$/);
    expect(result.target.expiresAt).toEqual(pending.expiresAt);
    expect(storage.createUploadTarget).toHaveBeenCalledWith(
      result.pending.pendingKey, "image/png", PHOTO_MAX_SIZE_BYTES, PHOTO_UPLOAD_TTL_SECONDS,
    );
  });

  it.each(["image/gif", "text/html", ""])("rejects unsupported type %s", async (contentType) => {
    await expect(service.prepareUpload("user-id", { contentType, sizeBytes: 100 }))
      .rejects.toBeInstanceOf(PhotoValidationError);
    expect(storage.createUploadTarget).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, PHOTO_MAX_SIZE_BYTES + 1, Number.NaN])(
    "rejects invalid declared size %s", async (sizeBytes) => {
      await expect(service.prepareUpload("user-id", { contentType: "image/png", sizeBytes }))
        .rejects.toBeInstanceOf(PhotoValidationError);
    },
  );

  it("copies to an immutable final key and validates the copied bytes", async () => {
    const result = await service.completeUpload(pending);

    expect(result).toMatchObject({
      ownerId: "user-id", contentType: "image/png", sizeBytes: png.length,
      width: 2, height: 3,
    });
    expect(result.objectKey).toMatch(/^photos\/[0-9a-f-]{36}$/);
    expect(storage.copy).toHaveBeenCalledWith(pending.pendingKey, result.objectKey);
    expect(storage.read).toHaveBeenCalledWith(result.objectKey, PHOTO_MAX_SIZE_BYTES);
    expect(storage.delete).toHaveBeenCalledWith(pending.pendingKey);
  });

  it.each([
    { contentType: "image/jpeg" as const, format: "jpeg" as const },
    { contentType: "image/webp" as const, format: "webp" as const },
  ])("accepts decoded $contentType bytes", async ({ contentType, format }) => {
    const bytes = await sharp(png).toFormat(format).toBuffer();
    pending.contentType = contentType;
    pending.declaredSizeBytes = bytes.length;
    vi.mocked(storage.inspect).mockResolvedValue({ sizeBytes: bytes.length });
    vi.mocked(storage.read).mockResolvedValue(bytes);

    await expect(service.completeUpload(pending)).resolves.toMatchObject({
      contentType, sizeBytes: bytes.length, width: 2, height: 3,
    });
  });

  it("rejects an expired upload before accessing storage", async () => {
    pending.expiresAt = now;
    await expect(service.completeUpload(pending)).rejects.toThrow("expired");
    expect(storage.inspect).not.toHaveBeenCalled();
  });

  it("rejects missing and mismatched pending objects before copying", async () => {
    vi.mocked(storage.inspect).mockResolvedValueOnce(null);
    await expect(service.completeUpload(pending)).rejects.toThrow("missing");
    vi.mocked(storage.inspect).mockResolvedValueOnce({ sizeBytes: png.length + 1 });
    await expect(service.completeUpload(pending)).rejects.toThrow("size does not match");
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("rejects a copied object whose size changes and removes it", async () => {
    // The first HEAD sees the pending upload; the second sees the final copy.
    vi.mocked(storage.inspect)
      .mockResolvedValueOnce({ sizeBytes: png.length })
      .mockResolvedValueOnce({ sizeBytes: png.length + 1 });
    await expect(service.completeUpload(pending)).rejects.toThrow("Copied photo size");
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^photos\//));
  });

  it("rejects a different image type even when it decodes", async () => {
    const jpeg = await sharp(png).jpeg().toBuffer();
    pending.declaredSizeBytes = jpeg.length;
    vi.mocked(storage.inspect).mockResolvedValue({ sizeBytes: jpeg.length });
    vi.mocked(storage.read).mockResolvedValue(jpeg);

    await expect(service.completeUpload(pending)).rejects.toThrow("declared photo type");
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^photos\//));
  });

  it("rejects corrupt image bytes and removes the final copy", async () => {
    const corrupt = Buffer.alloc(png.length, 0);
    vi.mocked(storage.read).mockResolvedValue(corrupt);
    await expect(service.completeUpload(pending)).rejects.toThrow("invalid");
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(/^photos\//));
  });

  it("reports a cleanup failure after validation failure", async () => {
    // The final copy cannot be published when validation and its cleanup both fail.
    vi.mocked(storage.read).mockResolvedValue(Buffer.alloc(png.length));
    vi.mocked(storage.delete).mockRejectedValue(new Error("S3 unavailable"));
    await expect(service.completeUpload(pending)).rejects.toBeInstanceOf(PhotoStorageError);
  });

  it("keeps a valid photo ready when pending-key deletion needs later cleanup", async () => {
    // A leftover pending key cannot change the already validated final copy.
    vi.mocked(storage.delete).mockRejectedValue(new Error("S3 unavailable"));
    await expect(service.completeUpload(pending)).resolves.toMatchObject({
      contentType: "image/png", width: 2, height: 3,
    });
  });

  it("issues a short-lived read URL and deletes a trusted ready photo", async () => {
    const photo: ReadyPhoto = {
      id: "photo-id", ownerId: "user-id", objectKey: "photos/photo-id",
      contentType: "image/png", sizeBytes: png.length, width: 2, height: 3,
    };
    await expect(service.createReadUrl(photo)).resolves.toBe("https://s3.example/read");
    expect(storage.createReadUrl).toHaveBeenCalledWith(photo.objectKey, PHOTO_READ_TTL_SECONDS);
    await service.deletePhoto(photo);
    expect(storage.delete).toHaveBeenCalledWith(photo.objectKey);
  });
});
