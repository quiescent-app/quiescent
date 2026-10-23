import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../../db/client.js";
import { RefreshTokenModel } from "../../model/refreshToken.model.js";
import { UserModel } from "../../model/user.model.js";
import { createTestDatabase } from "../database/database.js";

describe("RefreshTokenModel", () => {
  let client: PGlite;
  let model: RefreshTokenModel;
  let users: UserModel;

  beforeEach(async () => {
    const testDatabase = await createTestDatabase();
    client = testDatabase.client;
    const database = testDatabase.database as unknown as Database;
    model = new RefreshTokenModel(database);
    users = new UserModel(database);
  });

  afterEach(async () => {
    if (client) await client.close();
  });

  it("creates a refresh token and finds it by its hash", async () => {
    const user = await users.create({
      email: "reader@example.com",
      password: "hashed-password",
    });
    const token = {
      userId: user.id,
      familyId: "00000000-0000-4000-8000-000000000010",
      tokenHash: "hashed-refresh-token",
      expiresAt: new Date(Date.now() + 60_000),
    };

    await model.create(token);

    await expect(model.findByHash(token.tokenHash)).resolves.toMatchObject({
      ...token,
      revokedAt: null,
    });
  });

  it("rotates a token within its family and marks the old token revoked", async () => {
    const user = await users.create({
      email: "reader@example.com",
      password: "hashed-password",
    });
    const familyId = "00000000-0000-4000-8000-000000000011";
    const oldTokenHash = "old-refresh-token-hash";
    const replacementTokenHash = "replacement-refresh-token-hash";
    await model.create({
      userId: user.id,
      familyId,
      tokenHash: oldTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      model.rotate(
        oldTokenHash,
        replacementTokenHash,
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toEqual({ userId: user.id, familyId });

    await expect(model.findByHash(oldTokenHash)).resolves.toMatchObject({
      revokedAt: expect.any(Date),
    });
    await expect(model.findByHash(replacementTokenHash)).resolves.toMatchObject({
      userId: user.id,
      familyId,
      revokedAt: null,
    });
  });

  it("returns null when a token cannot be rotated", async () => {
    await expect(
      model.rotate(
        "unknown-token-hash",
        "replacement-token-hash",
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toBeNull();
  });

  it("does not rotate an expired token", async () => {
    const user = await users.create({
      email: "reader@example.com",
      password: "hashed-password",
    });
    await model.create({
      userId: user.id,
      familyId: "00000000-0000-4000-8000-000000000013",
      tokenHash: "expired-token-hash",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      model.rotate(
        "expired-token-hash",
        "replacement-token-hash",
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toBeNull();
    await expect(model.findByHash("replacement-token-hash")).resolves.toBeNull();
  });

  it("does not rotate a token that was already revoked", async () => {
    const user = await users.create({
      email: "reader@example.com",
      password: "hashed-password",
    });
    const familyId = "00000000-0000-4000-8000-000000000014";
    await model.create({
      userId: user.id,
      familyId,
      tokenHash: "revoked-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await model.revokeFamily(familyId);

    await expect(
      model.rotate(
        "revoked-token-hash",
        "replacement-token-hash",
        new Date(Date.now() + 60_000),
      ),
    ).resolves.toBeNull();
    await expect(model.findByHash("replacement-token-hash")).resolves.toBeNull();
  });

  it("revokes all active tokens in a family", async () => {
    const user = await users.create({
      email: "reader@example.com",
      password: "hashed-password",
    });
    const familyId = "00000000-0000-4000-8000-000000000012";
    const hashes = ["first-token-hash", "second-token-hash"];
    for (const tokenHash of hashes) {
      await model.create({
        userId: user.id,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      });
    }

    await model.revokeFamily(familyId);

    for (const tokenHash of hashes) {
      await expect(model.findByHash(tokenHash)).resolves.toMatchObject({
        revokedAt: expect.any(Date),
      });
    }
  });

  it("does not revoke tokens that belong to another family", async () => {
    const user = await users.create({
      email: "reader@example.com",
      password: "hashed-password",
    });
    const activeFamilyId = "00000000-0000-4000-8000-000000000015";
    const otherFamilyId = "00000000-0000-4000-8000-000000000016";
    await model.create({
      userId: user.id,
      familyId: activeFamilyId,
      tokenHash: "active-family-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await model.create({
      userId: user.id,
      familyId: otherFamilyId,
      tokenHash: "other-family-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await model.revokeFamily(activeFamilyId);

    await expect(model.findByHash("active-family-token-hash")).resolves.toMatchObject({
      revokedAt: expect.any(Date),
    });
    await expect(model.findByHash("other-family-token-hash")).resolves.toMatchObject({
      revokedAt: null,
    });
  });
});
