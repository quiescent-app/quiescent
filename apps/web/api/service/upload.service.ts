import { createHmac, randomUUID } from "node:crypto";

import { S3Client } from "@aws-sdk/client-s3";
import { jwtVerify, SignJWT } from "jose";
import sharp from "sharp";

import { AppError, HttpStatus } from "../errors/appError.js";
import { getJwtSecret } from "../utils/token.utils.js";
import { createS3Storage, type S3Storage } from "../storage/s3.storage.js";

export const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const PHOTO_UPLOAD_TTL_SECONDS = 300;
export const PHOTO_READ_TTL_SECONDS = 300;
const PHOTO_MAX_PIXELS = 16_777_216;
const PROFILE_IMAGE_UPLOAD_AUDIENCE = "quiescent:profile-image-upload";

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

// These records must come from trusted server code or a verified upload ticket.
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

  async prepareProfileImage(ownerId: string, input: { contentType: string; sizeBytes: number }) {
    const { pending, target } = await this.prepareUpload(ownerId, input);
    const uploadToken = await new SignJWT({
      contentType: pending.contentType,
      sizeBytes: pending.declaredSizeBytes,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience(PROFILE_IMAGE_UPLOAD_AUDIENCE)
      .setSubject(ownerId)
      .setJti(pending.id)
      .setExpirationTime(Math.floor(pending.expiresAt.getTime() / 1000))
      .sign(profileImageUploadKey());

    return { id: pending.id, uploadToken, target };
  }

  async completeProfileImage(ownerId: string, id: string, uploadToken: string) {
    const result = await jwtVerify(uploadToken, profileImageUploadKey(), {
      algorithms: ["HS256"],
      audience: PROFILE_IMAGE_UPLOAD_AUDIENCE,
      subject: ownerId,
      requiredClaims: ["exp", "jti"],
    }).catch(() => null);
    const payload = result?.payload;
    if (
      !payload || payload.jti !== id || typeof payload.exp !== "number" ||
      !isPhotoContentType(payload["contentType"]) || typeof payload["sizeBytes"] !== "number"
    ) {
      throw new AppError(HttpStatus.NOT_FOUND, "Photo upload not found or expired");
    }

    await this.completeUpload({
      id,
      ownerId,
      pendingKey: `pending/${id}`,
      contentType: payload["contentType"],
      declaredSizeBytes: payload["sizeBytes"],
      expiresAt: new Date(payload.exp * 1000),
    }, profileImageObjectKey(ownerId));

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
    const pendingKey = `pending/${id}`;
    const contentType = input.contentType;
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
  async completeUpload(pending: PendingPhotoUpload, publishKey?: string): Promise<ReadyPhoto> {
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
    const objectKey = publishKey ? `pending/validated/${id}` : `photos/${id}`;
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

      if (publishKey) {
        // Only publish the copy that was validated. The browser can still write to its pending key.
        await storage.copy(objectKey, publishKey);
        await storage.delete(objectKey).catch(() => undefined);
      }

      // Bucket lifecycle expiration removes temporary objects when deletion fails.
      await storage.delete(pending.pendingKey).catch(() => undefined);

      return {
        id,
        ownerId: pending.ownerId,
        objectKey: publishKey ?? objectKey,
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

  private getStorage(): S3Storage {
    this.storage ??= createPhotoStorage();
    return this.storage;
  }
}

export const uploadService = new UploadService();

function isPhotoContentType(value: unknown): value is PhotoContentType {
  return typeof value === "string" && contentTypes.has(value);
}

function profileImageUploadKey(): Buffer {
  // Use a different signing key so an upload ticket cannot act as an access token.
  return createHmac("sha256", getJwtSecret()).update(PROFILE_IMAGE_UPLOAD_AUDIENCE).digest();
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
