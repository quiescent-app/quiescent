import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authController } from "../../controller/auth.controller.js";
import { HttpStatus } from "../../errors/appError.js";
import { authService } from "../../service/auth.service.js";

const authResult = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "reader@example.com",
    displayName: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  accessToken: "access-token",
  refreshToken: "refresh-token",
} as Awaited<ReturnType<typeof authService.register>>;

function makeRequest(body: unknown): Request {
  return { body } as Request;
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("AuthController", () => {
  afterEach(() => vi.restoreAllMocks());

  it("should register credentials and return status code 201 with session data", async () => {
    const register = vi.spyOn(authService, "register").mockResolvedValue(authResult);
    const response = makeResponse();

    await authController.signUp(
      makeRequest({ email: "reader@example.com", password: "correct-password" }),
      response,
      vi.fn(),
    );

    expect(register).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "correct-password",
    });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(response.json).toHaveBeenCalledWith(authResult);
  });

  it("should log in credentials and return status code 200 with session data", async () => {
    const login = vi.spyOn(authService, "login").mockResolvedValue(authResult);
    const response = makeResponse();

    await authController.login(
      makeRequest({ email: "reader@example.com", password: "correct-password" }),
      response,
      vi.fn(),
    );

    expect(login).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "correct-password",
    });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith(authResult);
  });

  it("should refresh a session and return status code 200 with replacement session data", async () => {
    const refresh = vi.spyOn(authService, "refresh").mockResolvedValue(authResult);
    const response = makeResponse();

    await authController.refresh(
      makeRequest({ refreshToken: "old-refresh-token" }),
      response,
      vi.fn(),
    );

    expect(refresh).toHaveBeenCalledWith("old-refresh-token");
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith(authResult);
  });

  it("should log out and return status code 204 with no content", async () => {
    const logout = vi.spyOn(authService, "logout").mockResolvedValue(undefined);
    const response = makeResponse();

    await authController.logout(
      makeRequest({ refreshToken: "refresh-token" }),
      response,
      vi.fn(),
    );

    expect(logout).toHaveBeenCalledWith("refresh-token");
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
    expect(response.end).toHaveBeenCalledOnce();
  });
});
