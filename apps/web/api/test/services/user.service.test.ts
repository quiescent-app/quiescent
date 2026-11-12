import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, HttpStatus } from "../../errors/appError.js";
import { UserService } from "../../service/user.service.js";

const mocks = vi.hoisted(() => ({
  userModel: {
    findById: vi.fn(),
    updateDisplayName: vi.fn(),
  },
}));

vi.mock("../../model/user.model.js", () => ({ userModel: mocks.userModel }));

describe("UserService", () => {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "reader@example.com",
    displayName: null as string | null,
    password: "secret-hash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService();
  });

  it("should return only safe current-user profile fields", async () => {
    mocks.userModel.findById.mockResolvedValue(user);

    await expect(service.getProfile(user.id)).resolves.toEqual({
      id: user.id,
      email: user.email,
      displayName: null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });

  it("should return 404 when the authenticated user no longer exists", async () => {
    mocks.userModel.findById.mockResolvedValue(null);

    await expect(service.getProfile(user.id)).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      message: "User not found",
    });
  });

  it("should trim and save a valid display name", async () => {
    mocks.userModel.updateDisplayName.mockResolvedValue({ ...user, displayName: "Reader One" });

    await expect(service.updateProfile(user.id, "  Reader One  ")).resolves.toMatchObject({
      id: user.id,
      displayName: "Reader One",
    });
    expect(mocks.userModel.updateDisplayName).toHaveBeenCalledWith(user.id, "Reader One");
  });

  it.each([
    "",
    "     ",
    "x".repeat(41),
    "Reader!",
  ])("should reject an invalid display name: %s", async (displayName) => {
    await expect(service.updateProfile(user.id, displayName)).rejects.toMatchObject({
      statusCode: HttpStatus.BAD_REQUEST,
    } satisfies Partial<AppError>);
    expect(mocks.userModel.updateDisplayName).not.toHaveBeenCalled();
  });

  it("should return 404 when updating a user that no longer exists", async () => {
    mocks.userModel.updateDisplayName.mockResolvedValue(null);

    await expect(service.updateProfile(user.id, "Reader One")).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
    } satisfies Partial<AppError>);
  });
});
