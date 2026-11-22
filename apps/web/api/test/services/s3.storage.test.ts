import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, HttpStatus } from "../../errors/appError.js";
import { createS3Storage } from "../../storage/s3.storage.js";

// Keep signing local while asserting the policy passed to the AWS helpers.
vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn().mockResolvedValue({
    url: "https://s3.example/upload", fields: { key: "pending/id" },
  }),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example/read"),
}));

describe("createS3Storage", () => {
  const bucket = "quiescent-photos-dev";
  let send: ReturnType<typeof vi.fn>;
  let client: S3Client;
  let storage: ReturnType<typeof createS3Storage>;

  beforeEach(() => {
    // A fake client captures SDK commands without contacting S3.
    send = vi.fn();
    client = { send } as unknown as S3Client;
    storage = createS3Storage(client, bucket);
  });

  it.each(["image/png", "application/pdf"])(
    "signs a private upload form for %s with the exact key, type, size, and lifetime",
    async (contentType) => {
      const result = await storage.createUploadTarget("pending/id", contentType, 5_242_880, 300);

      expect(result).toEqual({ url: "https://s3.example/upload", fields: { key: "pending/id" } });
      expect(createPresignedPost).toHaveBeenCalledWith(client, {
        Bucket: bucket,
        Key: "pending/id",
        Conditions: [["content-length-range", 1, 5_242_880], ["eq", "$Content-Type", contentType]],
        Fields: { "Content-Type": contentType },
        Expires: 300,
      });
    },
  );

  it("inspects size and treats a missing key as absent", async () => {
    send.mockResolvedValueOnce({ ContentLength: 42 });
    await expect(storage.inspect("pending/id")).resolves.toEqual({ sizeBytes: 42 });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[0]?.[0].input).toEqual({ Bucket: bucket, Key: "pending/id" });

    send.mockRejectedValueOnce({ name: "NotFound" });
    await expect(storage.inspect("pending/missing")).resolves.toBeNull();
  });

  it("bounds reads with an S3 range and rejects oversized bodies", async () => {
    // Async generators stand in for the streaming GetObject response body.
    send.mockResolvedValueOnce({ Body: (async function* () { yield Buffer.from("abc"); })() });
    await expect(storage.read("photos/id", 3)).resolves.toEqual(Buffer.from("abc"));
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[0]?.[0].input).toEqual({
      Bucket: bucket, Key: "photos/id", Range: "bytes=0-3",
    });

    send.mockResolvedValueOnce({ Body: (async function* () { yield Buffer.from("abcd"); })() });
    await expect(storage.read("photos/id", 3)).rejects.toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    } satisfies Partial<AppError>);
  });

  it("copies to a distinct key, signs reads, and deletes by key", async () => {
    send.mockResolvedValue(undefined);
    await storage.copy("pending/id", "photos/id");
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(CopyObjectCommand);
    expect(send.mock.calls[0]?.[0].input).toEqual({
      Bucket: bucket, Key: "photos/id", CopySource: `${bucket}/pending/id`,
    });

    await expect(storage.createReadUrl("photos/id", 300))
      .resolves.toBe("https://s3.example/read");
    expect(getSignedUrl).toHaveBeenCalledWith(
      client, expect.any(GetObjectCommand), { expiresIn: 300 },
    );

    await storage.delete("photos/id");
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[1]?.[0].input).toEqual({ Bucket: bucket, Key: "photos/id" });
  });
});
