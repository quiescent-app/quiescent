import { randomUUID } from "node:crypto";

import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { AppError, HttpStatus } from "../errors/appError.js";
import { createS3Storage, type S3Storage } from "../storage/s3.storage.js";

export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const PHOTO_UPLOAD_TTL_SECONDS = 300;
export const PHOTO_READ_TTL_SECONDS = 300;
const PHOTO_MAX_PIXELS = 16_777_216;
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type PhotoContentType = "image/jpeg" | "image/png" | "image/webp";

const contentTypes: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface UploadTarget {
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

// These records must come from trusted server code or S3 metadata bound to a presigned form.
export interface PendingPhotoUpload {
  id: string;
  ownerId: string;
  pendingKey: string;
  contentType: PhotoContentType;
  declaredSizeBytes: number;
  expiresAt: Date;
}

export interface ReadyPhoto {
  id: string;
  ownerId: string;
  objectKey: string;
  contentType: PhotoContentType;
  sizeBytes: number;
  width: number;
  height: number;
}

export class UploadService {
  private storage: S3Storage | undefined;

  /** Validate the declared upload and create its pending record and S3 form. */
  async prepareUpload(
    ownerId: string,
    input: { contentType: string; sizeBytes: number },
  ): Promise<{ pending: PendingPhotoUpload; target: UploadTarget }> {
    const storage = this.getStorage();
    if (!ownerId) throw new AppError(HttpStatus.BAD_REQUEST, "Photo owner is required");
    if (!isPhotoContentType(input.contentType)) {
      throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported photo type");
    }
    if (
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > PHOTO_MAX_SIZE_BYTES
    ) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Photo size must be between 1 byte and 10 MiB");
    }

    const id = randomUUID();
    const pendingKey = pendingProfileImageKey(ownerId, id);
    const contentType = input.contentType;
    const expiresAt = new Date(Date.now() + PHOTO_UPLOAD_TTL_SECONDS * 1000);
    const target = await storage.createUploadTarget(
      pendingKey,
      contentType,
      PHOTO_MAX_SIZE_BYTES,
      PHOTO_UPLOAD_TTL_SECONDS,
      { "declared-size": String(input.sizeBytes), "upload-expires-at": String(expiresAt.getTime()) },
    );

    return {
      pending: { id, ownerId, pendingKey, contentType, declaredSizeBytes: input.sizeBytes, expiresAt },
      target: { ...target, expiresAt },
    };
  }

  async completeUpload(ownerId: string, id: string) {
    if (!UPLOAD_ID_PATTERN.test(id)) {
      throw new AppError(HttpStatus.NOT_FOUND, "Photo upload not found or expired");
    }

    const storage = this.getStorage();
    const pendingKey = pendingProfileImageKey(ownerId, id);
    const source = await storage.inspect(pendingKey);
    if (!source) throw new AppError(HttpStatus.NOT_FOUND, "Photo upload not found or expired");

    const { contentType, metadata } = source;
    const declaredSizeBytes = Number(metadata?.["declared-size"]);
    const expiresAt = new Date(Number(metadata?.["upload-expires-at"]));
    if (
      !isPhotoContentType(contentType) ||
      !Number.isSafeInteger(declaredSizeBytes) || declaredSizeBytes < 1 || declaredSizeBytes > PHOTO_MAX_SIZE_BYTES ||
      !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()
    ) {
      throw new AppError(HttpStatus.NOT_FOUND, "Photo upload not found or expired");
    }

    if (source.sizeBytes !== declaredSizeBytes) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Uploaded photo size does not match");
    }

    const stagedKey = `pending/validated/${randomUUID()}`;
    await storage.copy(pendingKey, stagedKey);

    try {
      const staged = await storage.inspect(stagedKey);
      if (!staged || staged.sizeBytes !== declaredSizeBytes) {
        throw new AppError(HttpStatus.BAD_REQUEST, "Copied photo size does not match");
      }
      const bytes = await storage.read(stagedKey, PHOTO_MAX_SIZE_BYTES);
      if (bytes.length !== staged.sizeBytes) {
        throw new AppError(HttpStatus.BAD_REQUEST, "Copied photo bytes are incomplete");
      }
      await validateImage(bytes, contentType);

      // Only publish the copy that was validated. The browser can still write to its pending key.
      await storage.copy(stagedKey, profileImageObjectKey(ownerId));
      await storage.delete(stagedKey).catch(() => undefined);

      // Bucket lifecycle expiration removes temporary objects when deletion fails.
      await storage.delete(pendingKey).catch(() => undefined);
    } catch (error) {
      try {
        // Attempt to clean up the staged photo if an error occurred.
        await storage.delete(stagedKey);
      } catch {
        throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Photo storage failed");
      }
      throw error;
    }

    return { id };
  }

  async getProfileImage(ownerId: string) {
    const storage = this.getStorage();
    const key = profileImageObjectKey(ownerId);
    if (!await storage.inspect(key)) return null;

    const url = await storage.createReadUrl(key, PHOTO_READ_TTL_SECONDS);
    return { url };
  }

  async deleteProfileImage(ownerId: string): Promise<void> {
    await this.getStorage().delete(profileImageObjectKey(ownerId));
  }

  /** Delete a ready photo after the caller has removed its references. */
  async deletePhoto(photo: ReadyPhoto): Promise<void> {
    await this.getStorage().delete(photo.objectKey);
  }

  private getStorage(): S3Storage {
    this.storage ??= createPhotoStorage();
    return this.storage;
  }
}

export const uploadService = new UploadService();

function isPhotoContentType(value: unknown): value is PhotoContentType {
  return typeof value === "string" && contentTypes.has(value);
}

function pendingProfileImageKey(ownerId: string, id: string): string {
  return `pending/profile/${encodeURIComponent(ownerId)}/${id}`;
}

function profileImageObjectKey(ownerId: string): string {
  return `photos/profile/${encodeURIComponent(ownerId)}`;
}

/** Configure the directly imported S3 adapter for this backend environment. */
function createPhotoStorage(): S3Storage {
  const region = process.env["AWS_REGION"];
  const bucket = process.env["S3_PHOTO_BUCKET"];
  if (!region || !bucket) {
    throw new Error("AWS_REGION and S3_PHOTO_BUCKET are required for photo storage");
  }
  return createS3Storage(new S3Client({ region }), bucket);
}

/** Decode the full image and confirm its type, dimensions, and single-frame policy. */
async function validateImage(
  bytes: Buffer,
  expectedContentType: PhotoContentType,
): Promise<void> {
  try {
    const image = sharp(bytes, { limitInputPixels: PHOTO_MAX_PIXELS, failOn: "error" });
    const metadata = await image.metadata();
    const actualContentType: string | undefined = ({
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    } as Record<string, string>)[metadata.format ?? ""];

    if (
      actualContentType !== expectedContentType ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Uploaded bytes are not the declared photo type");
    }
    await image.stats(); // Decode all pixels rather than trusting image headers alone.
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(HttpStatus.BAD_REQUEST, "Uploaded photo is invalid or exceeds pixel limit");
  }
}
