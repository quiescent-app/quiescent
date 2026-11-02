import { randomUUID } from "node:crypto";

import * as argon2 from "argon2";

import { AppError, HttpStatus } from "../errors/appError.js";
import { userModel } from "../model/user.model.js";
import { refreshTokenModel } from "../model/refreshToken.model.js";
import type { User, AuthUser } from "../schema/user.schema.js";
import {
  isEmailUniqueViolation,
  normalizeEmail,
  toAuthUser,
} from "../utils/auth.utils.js";
import {
  createAccessToken,
  createRefreshToken,
  getJwtSecret,
  hashRefreshToken,
} from "../utils/token.utils.js";

type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}



const REFRESH_TOKEN_LIFETIME_MILLISECONDS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_PASSWORD_LENGTH = 8;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export class AuthService {
  private readonly jwtSecret = getJwtSecret();
  private readonly passwordHasher: PasswordHasher = {
    hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
    verify: (hash, password) => argon2.verify(hash, password),
  };

  async register(input: {email: string, password: string}): Promise<AuthResult> {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      );
    }

    const email = normalizeEmail(input.email);
    const password = await this.passwordHasher.hash(input.password);

    let user: User;
    try {
      user = await userModel.create({ email, password });
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new AppError(HttpStatus.CONFLICT, "An account with this email already exists");
      }
      throw error;
    }

    return this.createAuthResult(user, randomUUID());
  }

  async login(input: {email: string, password: string}): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const user = await userModel.findByEmail(email);

    if (!user || !(await this.passwordHasher.verify(user.password, input.password))) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    return this.createAuthResult(user, randomUUID());
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    if (!refreshToken) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    const oldHash = hashRefreshToken(refreshToken);
    const existing = await refreshTokenModel.findByHash(oldHash);

    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    if (existing.revokedAt) {
      await refreshTokenModel.revokeFamily(existing.familyId);
      throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    const user = await userModel.findById(existing.userId);
    if (!user) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    const accessToken = await createAccessToken(existing.userId, this.jwtSecret);
    const replacementToken = createRefreshToken();
    const rotated = await refreshTokenModel.rotate(
      oldHash,
      hashRefreshToken(replacementToken),
      new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MILLISECONDS),
    );

    if (!rotated) {
      const latest = await refreshTokenModel.findByHash(oldHash);
      if (latest?.revokedAt) {
        await refreshTokenModel.revokeFamily(latest.familyId);
      }
      throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    return {
      user: toAuthUser(user),
      accessToken,
      refreshToken: replacementToken,
    };
  }

  async logout(refreshToken: string | null | undefined): Promise<void> {
    if (!refreshToken) return;

    const token = await refreshTokenModel.findByHash(hashRefreshToken(refreshToken));
    if (token) await refreshTokenModel.revokeFamily(token.familyId);
  }

  private async createAuthResult(
    user: User,
    familyId: string,
  ): Promise<AuthResult> {
    const accessToken = await createAccessToken(user.id, this.jwtSecret);
    const refreshToken = createRefreshToken();

    await refreshTokenModel.create({
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MILLISECONDS),
    });

    return { user: toAuthUser(user), accessToken, refreshToken };
  }
}

export const authService = new AuthService();

