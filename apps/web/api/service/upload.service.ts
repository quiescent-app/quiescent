import { randomUUID } from "node:crypto";

import sharp from "sharp";

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

export class PhotoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoValidationError";
  }
}

export class PhotoStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoStorageError";
  }
}

export class UploadService {
  constructor(
    private readonly storage: PhotoStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Validate the declared upload and create its pending record and S3 form. */
  async prepareUpload(
    ownerId: string,
    input: { contentType: string; sizeBytes: number },
  ): Promise<{ pending: PendingPhotoUpload; target: UploadTarget }> {
    if (!ownerId) throw new PhotoValidationError("Photo owner is required");
    if (!contentTypes.has(input.contentType)) {
      throw new PhotoValidationError("Unsupported photo type");
    }
    if (
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > PHOTO_MAX_SIZE_BYTES
    ) {
      throw new PhotoValidationError("Photo size must be between 1 byte and 10 MiB");
    }

    const id = randomUUID();
    const pendingKey = `pending/${id}`;
    const contentType = input.contentType as PhotoContentType;
    const expiresAt = new Date(this.now().getTime() + PHOTO_UPLOAD_TTL_SECONDS * 1000);
    const target = await this.storage.createUploadTarget(
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
    if (pending.expiresAt.getTime() <= this.now().getTime()) {
      throw new PhotoValidationError("Photo upload has expired");
    }

    const source = await this.storage.inspect(pending.pendingKey);
    if (!source) throw new PhotoValidationError("Photo upload is missing");
    if (source.sizeBytes !== pending.declaredSizeBytes || source.sizeBytes > PHOTO_MAX_SIZE_BYTES) {
      throw new PhotoValidationError("Uploaded photo size does not match");
    }

    const id = randomUUID();
    const objectKey = `photos/${id}`;
    await this.storage.copy(pending.pendingKey, objectKey);

    try {
      const final = await this.storage.inspect(objectKey);
      if (!final || final.sizeBytes !== pending.declaredSizeBytes) {
        throw new PhotoValidationError("Copied photo size does not match");
      }
      const bytes = await this.storage.read(objectKey, PHOTO_MAX_SIZE_BYTES);
      if (bytes.length !== final.sizeBytes) {
        throw new PhotoValidationError("Copied photo bytes are incomplete");
      }
      const dimensions = await validateImage(bytes, pending.contentType);

      // A failure to remove the pending object is safe: a later cleanup pass
      // can remove it without changing the immutable final object.
      try {
        await this.storage.delete(pending.pendingKey);
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
        await this.storage.delete(objectKey);
      } catch {
        throw new PhotoStorageError("Photo validation failed and copied object cleanup failed");
      }
      throw error;
    }
  }

  /** Sign a read URL for a ready photo already authorized by the caller. */
  async createReadUrl(photo: ReadyPhoto): Promise<string> {
    return this.storage.createReadUrl(photo.objectKey, PHOTO_READ_TTL_SECONDS);
  }

  /** Delete a ready photo after the caller has removed its references. */
  async deletePhoto(photo: ReadyPhoto): Promise<void> {
    await this.storage.delete(photo.objectKey);
  }
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
      throw new PhotoValidationError("Uploaded bytes are not the declared photo type");
    }
    await image.stats(); // Decode all pixels rather than trusting image headers alone.
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof PhotoValidationError) throw error;
    throw new PhotoValidationError("Uploaded photo is invalid or exceeds pixel limit");
  }
}
