import { randomUUID } from "node:crypto";

import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { AppError, HttpStatus } from "../errors/appError.js";
import { createS3PhotoStorage } from "./s3-photo.storage.js";

export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const PHOTO_UPLOAD_TTL_SECONDS = 300;
export const PHOTO_READ_TTL_SECONDS = 300;
const PHOTO_MAX_PIXELS = 16_777_216;

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

export interface StoredObject {
  sizeBytes: number;
}

export interface PhotoStorage {
  /** Issue a temporary form that can upload only to the generated pending key. */
  createUploadTarget(
    key: string,
    contentType: PhotoContentType,
    maxSizeBytes: number,
    expiresInSeconds: number,
  ): Promise<Omit<UploadTarget, "expiresAt">>;
  /** Return the object's current size, or null when it does not exist. */
  inspect(key: string): Promise<StoredObject | null>;
  /** Read at most maxBytes for server-side image validation. */
  read(key: string, maxBytes: number): Promise<Buffer>;
  /** Copy uploaded bytes to a separate key that the upload form cannot overwrite. */
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  /** Issue a temporary URL for reading a validated photo. */
  createReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Remove an object; callers decide when deletion is safe. */
  delete(key: string): Promise<void>;
}

// These records must be persisted and loaded by trusted server code in a later stage.
// A caller must never construct one from a client-supplied key or owner ID.
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
  private storage: PhotoStorage | undefined;

  /** Validate the declared upload and create its pending record and S3 form. */
  async prepareUpload(
    ownerId: string,
    input: { contentType: string; sizeBytes: number },
  ): Promise<{ pending: PendingPhotoUpload; target: UploadTarget }> {
    const storage = this.getStorage();
    if (!ownerId) throw new AppError(HttpStatus.BAD_REQUEST, "Photo owner is required");
    if (!contentTypes.has(input.contentType)) {
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
    const pendingKey = `pending/${id}`;
    const contentType = input.contentType as PhotoContentType;
    const expiresAt = new Date(Date.now() + PHOTO_UPLOAD_TTL_SECONDS * 1000);
    const target = await storage.createUploadTarget(
      pendingKey,
      contentType,
      PHOTO_MAX_SIZE_BYTES,
      PHOTO_UPLOAD_TTL_SECONDS,
    );

    return {
      pending: { id, ownerId, pendingKey, contentType, declaredSizeBytes: input.sizeBytes, expiresAt },
      target: { ...target, expiresAt },
    };
  }

  /** Validate a trusted pending upload and return metadata for its final copy. */
  async completeUpload(pending: PendingPhotoUpload): Promise<ReadyPhoto> {
    const storage = this.getStorage();
    if (pending.expiresAt.getTime() <= Date.now()) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Photo upload has expired");
    }

    const source = await storage.inspect(pending.pendingKey);
    if (!source) throw new AppError(HttpStatus.NOT_FOUND, "Photo upload is missing");
    if (source.sizeBytes !== pending.declaredSizeBytes || source.sizeBytes > PHOTO_MAX_SIZE_BYTES) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Uploaded photo size does not match");
    }

    const id = randomUUID();
    const objectKey = `photos/${id}`;
    await storage.copy(pending.pendingKey, objectKey);

    try {
      const final = await storage.inspect(objectKey);
      if (!final || final.sizeBytes !== pending.declaredSizeBytes) {
        throw new AppError(HttpStatus.BAD_REQUEST, "Copied photo size does not match");
      }
      const bytes = await storage.read(objectKey, PHOTO_MAX_SIZE_BYTES);
      if (bytes.length !== final.sizeBytes) {
        throw new AppError(HttpStatus.BAD_REQUEST, "Copied photo bytes are incomplete");
      }
      const dimensions = await validateImage(bytes, pending.contentType);

      // A failure to remove the pending object is safe: a later cleanup pass
      // can remove it without changing the immutable final object.
      try {
        await storage.delete(pending.pendingKey);
      } catch {
        // Deferred cleanup is the responsibility of the future persistence layer.
      }

      return {
        id,
        ownerId: pending.ownerId,
        objectKey,
        contentType: pending.contentType,
        sizeBytes: final.sizeBytes,
        ...dimensions,
      };
    } catch (error) {
      try {
        await storage.delete(objectKey);
      } catch {
        throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Photo storage failed");
      }
      throw error;
    }
  }

  /** Sign a read URL for a ready photo already authorized by the caller. */
  async createReadUrl(photo: ReadyPhoto): Promise<string> {
    return this.getStorage().createReadUrl(photo.objectKey, PHOTO_READ_TTL_SECONDS);
  }

  /** Delete a ready photo after the caller has removed its references. */
  async deletePhoto(photo: ReadyPhoto): Promise<void> {
    await this.getStorage().delete(photo.objectKey);
  }

  private getStorage(): PhotoStorage {
    this.storage ??= createPhotoStorage();
    return this.storage;
  }
}

export const uploadService = new UploadService();

/** Configure the directly imported S3 adapter for this backend environment. */
function createPhotoStorage(): PhotoStorage {
  const region = process.env["AWS_REGION"];
  const bucket = process.env["S3_PHOTO_BUCKET"];
  if (!region || !bucket) {
    throw new Error("AWS_REGION and S3_PHOTO_BUCKET are required for photo storage");
  }
  return createS3PhotoStorage(new S3Client({ region }), bucket);
}

/** Decode the full image and confirm its type, dimensions, and single-frame policy. */
async function validateImage(
  bytes: Buffer,
  expectedContentType: PhotoContentType,
): Promise<{ width: number; height: number }> {
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
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(HttpStatus.BAD_REQUEST, "Uploaded photo is invalid or exceeds pixel limit");
  }
}
