import sharp from "sharp";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import { createAccessToken } from "../../utils/token.utils.js";

const { objects, storage } = vi.hoisted(() => {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    storage: {
      createUploadTarget: vi.fn(async (key: string) => ({
        url: "https://s3.example", fields: { key },
      })),
      inspect: vi.fn(async (key: string) => {
        const bytes = objects.get(key);
        return bytes ? { sizeBytes: bytes.length } : null;
      }),
      read: vi.fn(async (key: string) => {
        const bytes = objects.get(key);
        if (!bytes) throw new Error("Object missing");
        return bytes;
      }),
      copy: vi.fn(async (from: string, to: string) => {
        const bytes = objects.get(from);
        if (!bytes) throw new Error("Object missing");
        objects.set(to, bytes);
      }),
      createReadUrl: vi.fn(async (key: string) => `https://s3.example/${key}`),
      delete: vi.fn(async (key: string) => { objects.delete(key); }),
    },
  };
});

vi.mock("../../storage/s3.storage.js", () => ({
  createS3Storage: () => storage,
}));

describe("profile image routes", () => {
  const base = "/users/me/profile-image";
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const otherId = "00000000-0000-4000-8000-000000000002";
  const currentKey = `photos/profile/${ownerId}`;
  const app = createApp();
  let ownerToken: string;
  let otherToken: string;
  let png: Buffer;

  beforeEach(async () => {
    vi.stubEnv("AWS_REGION", "us-east-2");
    vi.stubEnv("S3_PHOTO_BUCKET", "quiescent-test-photos");
    vi.clearAllMocks();
    objects.clear();
    ownerToken = await createAccessToken(ownerId);
    otherToken = await createAccessToken(otherId);
    png = await sharp({
      create: { width: 2, height: 3, channels: 3, background: "red" },
    }).png().toBuffer();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  async function prepare(bytes = png) {
    const response = await request(app).post(`${base}/uploads`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ contentType: "image/png", sizeBytes: bytes.length, ownerId: otherId })
      .expect(201);
    const upload = response.body as {
      id: string;
      uploadToken: string;
      target: { fields: { key: string } };
    };
    objects.set(upload.target.fields.key, bytes);
    return upload;
  }

  function complete(upload: { id: string; uploadToken: string }, token = ownerToken) {
    return request(app).post(`${base}/uploads/${upload.id}/complete`)
      .set("Authorization", `Bearer ${token}`).send({ uploadToken: upload.uploadToken });
  }

  function image(method: "get" | "delete", token = ownerToken) {
    return request(app)[method](base).set("Authorization", `Bearer ${token}`);
  }

  it("requires an access token for every image operation", async () => {
    await request(app).get(base).expect(401);
    await request(app).post(`${base}/uploads`).expect(401);
    await request(app).post(`${base}/uploads/id/complete`).expect(401);
    await request(app).delete(base).expect(401);

    const upload = await prepare();
    await image("get", upload.uploadToken).expect(401);
    await complete({ ...upload, uploadToken: ownerToken }).expect(404);
    await complete(upload, otherToken).expect(404);
    await complete({ ...upload, id: otherId }).expect(404);
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("validates a private copy and publishes, reads, replaces, and removes the owner's image", async () => {
    await image("get").expect(200, { image: null });
    const upload = await prepare();
    await complete(upload).expect(200, { id: upload.id });
    const stagedKey = storage.copy.mock.calls[0]?.[1];
    expect(stagedKey).toMatch(/^pending\/validated\//);
    expect(storage.read).toHaveBeenCalledWith(stagedKey, 10 * 1024 * 1024);
    expect(storage.copy).toHaveBeenNthCalledWith(2, stagedKey, currentKey);
    expect([...objects.keys()]).toEqual([currentKey]);

    await image("get").expect("Cache-Control", "no-store")
      .expect(200, { image: { url: `https://s3.example/${currentKey}` } });
    await image("get", otherToken).expect(200, { image: null });
    await image("delete", otherToken).expect(204);
    expect(objects.get(currentKey)).toEqual(png);

    const replacement = await sharp(png).negate().png().toBuffer();
    const next = await prepare(replacement);
    await complete(next).expect(200, { id: next.id });
    expect(objects.get(currentKey)).toEqual(replacement);

    await image("delete").expect(204);
    await image("get").expect(200, { image: null });
  });

  it("keeps the current image when a replacement is invalid or its ticket expires", async () => {
    const original = await prepare();
    await complete(original).expect(200);
    const invalid = await prepare(Buffer.alloc(png.length));
    await complete(invalid).expect(400);
    expect(objects.get(currentKey)).toEqual(png);

    vi.useFakeTimers({ toFake: ["Date"] });
    const expired = await prepare();
    vi.setSystemTime(Date.now() + 301_000);
    await complete(expired).expect(404);
    expect(objects.get(currentKey)).toEqual(png);
  });
});
