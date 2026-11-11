import { AppError, HttpStatus } from "../errors/appError.js";
import { userModel } from "../model/user.model.js";
import { toAuthUser } from "../utils/auth.utils.js";

const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N} ._-]+$/u;

export function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.normalize("NFC").trim();
  const length = Array.from(normalized).length;

  if (length < 1 || length > 40 || !DISPLAY_NAME_PATTERN.test(normalized)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Display name must be 1–40 characters and may contain letters, numbers, spaces, periods, underscores, and hyphens",
    );
  }

  return normalized;
}

export class UserService {
  async getProfile(userId: string) {
    const user = await userModel.findById(userId);
    if (!user) throw new AppError(HttpStatus.NOT_FOUND, "User not found");
    return toAuthUser(user);
  }

  async updateProfile(userId: string, displayName: string) {
    const normalizedName = normalizeDisplayName(displayName);
    const user = await userModel.updateDisplayName(userId, normalizedName);
    if (!user) throw new AppError(HttpStatus.NOT_FOUND, "User not found");
    return toAuthUser(user);
  }
}

export const userService = new UserService();
