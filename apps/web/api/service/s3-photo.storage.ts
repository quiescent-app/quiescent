import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { AppError, HttpStatus } from "../errors/appError.js";
import type {
  PhotoContentType,
  PhotoStorage,
  StoredObject,
} from "./upload.service.js";

/** Bind storage operations to one environment's bucket without a class instance. */
export function createS3PhotoStorage(client: S3Client, bucket: string): PhotoStorage {
  if (!bucket) throw new Error("Photo bucket is required");

  return {
  /** Create a presigned POST with an exact key, media type, size cap, and expiry. */
  async createUploadTarget(
    key: string,
    contentType: PhotoContentType,
    maxSizeBytes: number,
    expiresInSeconds: number,
  ): Promise<{ url: string; fields: Record<string, string> }> {
    return createPresignedPost(client, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 1, maxSizeBytes],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: { "Content-Type": contentType },
      Expires: expiresInSeconds,
    });
  },

  /** Read object metadata without downloading its contents. */
  async inspect(key: string): Promise<StoredObject | null> {
    try {
      const object = await client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      if (object.ContentLength === undefined) {
        throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Photo storage failed");
      }
      return { sizeBytes: object.ContentLength };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  },

  /** Stream a bounded byte range so image validation cannot load an oversized object. */
  async read(key: string, maxBytes: number): Promise<Buffer> {
    // Range bounds memory even if a pending key changes after its HEAD request.
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${maxBytes}`,
    }));
    const body = response.Body;
    if (!body || !(Symbol.asyncIterator in body)) {
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Photo storage failed");
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of body) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) {
        throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Photo storage failed");
      }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, size);
  },

  /** Promote a pending object by copying it to a separate final key. */
  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      CopySource: `${bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
    }));
  },

  /** Sign a temporary GET request for an authorized photo. */
  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }), { expiresIn: expiresInSeconds });
  },

  /** Delete an object from this adapter's bucket. */
  async delete(key: string): Promise<void> {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  },
  };
}

/** Recognize S3's missing-object responses while preserving other errors. */
function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return error.name === "NotFound" || error.name === "NoSuchKey";
}
