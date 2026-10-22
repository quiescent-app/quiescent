import { describe, expect, it, vi } from "vitest";

import {
  AuthService,
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

function makeUser(): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "reader@example.com",
    password: "hashed:correct-password",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function makeAuthService() {
  const user = makeUser();
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

  it("logs in with a normalized email and rejects invalid credentials", async () => {
    const validLogin = makeAuthService();

    const result = await validLogin.service.login({
      email: " READER@example.com ",
      password: "correct-password",
    });

    expect(validLogin.users.findByEmail).toHaveBeenCalledWith("reader@example.com");
    expect(result.user.id).toBe(validLogin.user.id);
    expect(validLogin.refreshTokens.create).toHaveBeenCalledOnce();

    const invalidLogin = makeAuthService();
    await expect(
      invalidLogin.service.login({
        email: "reader@example.com",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(invalidLogin.refreshTokens.create).not.toHaveBeenCalled();
  });

  it("rotates a valid refresh token and rejects an invalid one", async () => {
    const { service, user, refreshTokens } = makeAuthService();
    const oldToken = "old-refresh-token";
    refreshTokens.findByHash.mockResolvedValue({
      id: "token-row-id",
      userId: user.id,
      familyId: "family-id",
      tokenHash: hashRefreshToken(oldToken),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      revokedAt: null,
    });

    const result = await service.refresh(oldToken);

    expect(refreshTokens.rotate).toHaveBeenCalledWith(
      hashRefreshToken(oldToken),
      hashRefreshToken(result.refreshToken),
      expect.any(Date),
    );
    expect(result.user.id).toBe(user.id);

    const invalidRefresh = makeAuthService();
    await expect(invalidRefresh.service.refresh("")).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
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
