import { describe, expect, it, vi } from "vitest";
import { NeonDbError } from "@neondatabase/serverless";

import {
  AuthService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidPasswordError,
  InvalidRefreshTokenError,
  type PasswordHasher,
} from "../../service/auth.service.js";
import { RefreshTokenModel } from "../../model/refreshToken.model.js";
import { UserModel } from "../../model/user.model.js";
import type { User } from "../../schema/user.schema.js";
import { hashRefreshToken } from "../../utils/token.utils.js";

const jwtSecret = new TextEncoder().encode("test-secret-that-is-at-least-32-bytes");

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "reader@example.com",
    password: "hashed:correct-password",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeAuthService(user = makeUser()) {
  const passwordHasher: PasswordHasher = {
    hash: vi.fn(async (password) => `hashed:${password}`),
    verify: vi.fn(async (hash, password) => hash === `hashed:${password}`),
  };
  const users = {
    create: vi.fn<UserModel["create"]>(async () => user),
    findByEmail: vi.fn<UserModel["findByEmail"]>(async () => user),
    findById: vi.fn<UserModel["findById"]>(async () => user),
  };
  const refreshTokens = {
    create: vi.fn<RefreshTokenModel["create"]>(async () => undefined),
    findByHash: vi.fn<RefreshTokenModel["findByHash"]>(async () => null),
    rotate: vi.fn<RefreshTokenModel["rotate"]>(async () => ({
      userId: user.id,
      familyId: "family-id",
    })),
    revokeFamily: vi.fn<RefreshTokenModel["revokeFamily"]>(async () => undefined),
  };
  const service = new AuthService(
    users as unknown as UserModel,
    refreshTokens as unknown as RefreshTokenModel,
    passwordHasher,
    jwtSecret,
  );

  return { service, user, passwordHasher, users, refreshTokens };
}

describe("AuthService", () => {
  it("registers a user and returns tokens with a safe user record", async () => {
    const { service, user, users, refreshTokens } = makeAuthService();

    const result = await service.register({
      email: " Reader@Example.com ",
      password: "correct-password",
    });

    expect(users.create).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "hashed:correct-password",
    });
    expect(result.user).toEqual({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    expect(result.user).not.toHaveProperty("password");
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));

    const [savedToken] = refreshTokens.create.mock.calls[0] ?? [];
    expect(savedToken).toMatchObject({
      userId: user.id,
      tokenHash: hashRefreshToken(result.refreshToken),
    });
  });

  it("rejects a short password without creating a user", async () => {
    const { service, users } = makeAuthService();

    await expect(
      service.register({ email: "reader@example.com", password: "short" }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
    expect(users.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate email error and does not create tokens", async () => {
    const { service, users, refreshTokens } = makeAuthService();
    const duplicateEmailError = Object.assign(
      Object.create(NeonDbError.prototype) as NeonDbError,
      { code: "23505", constraint: "users_email_unique" },
    );
    users.create.mockRejectedValue(duplicateEmailError);

    await expect(
      service.register({ email: " READER@example.com ", password: "correct-password" }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    expect(users.create).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "hashed:correct-password",
    });
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it("propagates user creation failures without creating tokens", async () => {
    const { service, users, refreshTokens } = makeAuthService();
    const databaseError = new Error("database unavailable");
    users.create.mockRejectedValue(databaseError);

    await expect(
      service.register({ email: "reader@example.com", password: "correct-password" }),
    ).rejects.toBe(databaseError);
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it("logs in with a normalized email", async () => {
    const validLogin = makeAuthService();

    const result = await validLogin.service.login({
      email: " READER@example.com ",
      password: "correct-password",
    });

    expect(validLogin.users.findByEmail).toHaveBeenCalledWith("reader@example.com");
    expect(result.user.id).toBe(validLogin.user.id);
    expect(validLogin.refreshTokens.create).toHaveBeenCalledOnce();
  });

  it("rejects invalid login credentials", async () => {
    const invalidLogin = makeAuthService();
    await expect(
      invalidLogin.service.login({
        email: "reader@example.com",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(invalidLogin.refreshTokens.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown login email without verifying or creating tokens", async () => {
    const { service, users, passwordHasher, refreshTokens } = makeAuthService();
    users.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: "missing@example.com", password: "correct-password" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it("issues different tokens to different users", async () => {
    const firstUser = makeAuthService(makeUser());
    const secondUser = makeAuthService(
      makeUser({
        id: "00000000-0000-4000-8000-000000000002",
        email: "another-reader@example.com",
      }),
    );

    const firstResult = await firstUser.service.login({
      email: "reader@example.com",
      password: "correct-password",
    });
    const secondResult = await secondUser.service.login({
      email: "another-reader@example.com",
      password: "correct-password",
    });

    expect(firstResult.user.id).not.toBe(secondResult.user.id);
    expect(firstResult.accessToken).not.toBe(secondResult.accessToken);
    expect(firstResult.refreshToken).not.toBe(secondResult.refreshToken);
  });

  it("rotates the newest valid refresh token in its family", async () => {
    const { service, user, refreshTokens } = makeAuthService();
    const currentToken = "current-refresh-token";
    refreshTokens.findByHash.mockResolvedValue({
      id: "token-row-id",
      userId: user.id,
      familyId: "family-id",
      tokenHash: hashRefreshToken(currentToken),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null,
    });

    const result = await service.refresh(currentToken);

    expect(refreshTokens.rotate).toHaveBeenCalledWith(
      hashRefreshToken(currentToken),
      hashRefreshToken(result.refreshToken),
      expect.any(Date),
    );
    expect(refreshTokens.rotate).toHaveBeenCalledOnce();
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    expect(result.user.id).toBe(user.id);
  });

  it("revokes the token family when an older refresh token is reused", async () => {
    const { service, user, refreshTokens } = makeAuthService();
    const olderToken = "older-refresh-token";
    refreshTokens.findByHash.mockResolvedValue({
      id: "older-token-row-id",
      userId: user.id,
      familyId: "family-id",
      tokenHash: hashRefreshToken(olderToken),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: new Date(),
    });

    await expect(service.refresh(olderToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
    expect(refreshTokens.revokeFamily).toHaveBeenCalledOnce();
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith("family-id");
  });

  it("rejects an unknown refresh token without rotating or revoking a family", async () => {
    const { service, refreshTokens } = makeAuthService();

    await expect(service.refresh("unknown-refresh-token")).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it("rejects an expired refresh token", async () => {
    const { service, user, refreshTokens } = makeAuthService();
    refreshTokens.findByHash.mockResolvedValue({
      id: "expired-token-row-id",
      userId: user.id,
      familyId: "family-id",
      tokenHash: hashRefreshToken("expired-refresh-token"),
      expiresAt: new Date(Date.now() - 1),
      createdAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    });

    await expect(service.refresh("expired-refresh-token")).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it("rejects a refresh token when its user no longer exists", async () => {
    const { service, user, users, refreshTokens } = makeAuthService();
    refreshTokens.findByHash.mockResolvedValue({
      id: "orphaned-token-row-id",
      userId: user.id,
      familyId: "family-id",
      tokenHash: hashRefreshToken("orphaned-refresh-token"),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null,
    });
    users.findById.mockResolvedValue(null);

    await expect(service.refresh("orphaned-refresh-token")).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
  });

  it("revokes the family when a concurrent rotation reveals the token was consumed", async () => {
    const { service, user, refreshTokens } = makeAuthService();
    const token = "racing-refresh-token";
    const currentRecord = {
      id: "racing-token-row-id",
      userId: user.id,
      familyId: "family-id",
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null,
    };
    refreshTokens.findByHash
      .mockResolvedValueOnce(currentRecord)
      .mockResolvedValueOnce({ ...currentRecord, revokedAt: new Date() });
    refreshTokens.rotate.mockResolvedValueOnce(null);

    await expect(service.refresh(token)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(refreshTokens.findByHash).toHaveBeenCalledTimes(2);
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith("family-id");
  });

  it("revokes the refresh-token family when logging out", async () => {
    const { service, refreshTokens } = makeAuthService();
    refreshTokens.findByHash.mockResolvedValue({
      id: "token-row-id",
      userId: makeUser().id,
      familyId: "family-id",
      tokenHash: hashRefreshToken("refresh-token"),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null,
    });

    await service.logout("refresh-token");

    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith("family-id");
  });
});
