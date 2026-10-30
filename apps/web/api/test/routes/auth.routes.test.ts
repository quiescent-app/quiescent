import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { AppError, HttpStatus } from "../../errors/appError.js";
import { AuthService } from "../../service/auth.service.js";
import { ArticleService } from "../../service/article.service.js";

const authResult = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "reader@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  accessToken: "access-token",
  refreshToken: "refresh-token",
};

function makeService() {
  return {
    register: vi.fn(async () => authResult),
    login: vi.fn(async () => authResult),
    refresh: vi.fn(async () => authResult),
    logout: vi.fn(async () => undefined),
  };
}

function makeArticleService() {
  return {
    createArticle: vi.fn(),
    getArticles: vi.fn(),
    getArticleById: vi.fn(),
    getArticleByUrl: vi.fn(),
    updateArticle: vi.fn(),
    deleteArticle: vi.fn(),
  };
}

describe("authentication routes", () => {
  async function send(
    service: ReturnType<typeof makeService>,
    path: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<request.Response> {
    const app = createApp(
      service as unknown as AuthService,
      makeArticleService() as unknown as ArticleService,
    );

    return request(app)
      .post(path)
      .set({ "content-type": "application/json", ...headers })
      .send(body);
  }

  it("should return status code 201 with safe user and session data after sign-up", async () => {
    const service = makeService();
    const response = await send(
      service,
      "/auth/sign-up",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
    );

    expect(response.status).toBe(HttpStatus.CREATED);
    const result = response.body;
    expect(result).toEqual(authResult);
    expect(result.user).not.toHaveProperty("password");
    expect(service.register).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "correct-password",
    });
  });

  it("should return status code 200 with user and session data after login", async () => {
    const service = makeService();
    const response = await send(
      service,
      "/auth/login",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual(authResult);
    expect(service.login).toHaveBeenCalledOnce();
  });

  it("should return a 400 error when the JSON body is malformed", async () => {
    const malformed = await send(makeService(), "/auth/sign-up", "{");
    expect(malformed.status).toBe(HttpStatus.BAD_REQUEST);
    expect(malformed.body).toEqual({
      error: { message: "Request body must contain valid JSON" },
    });

  });

  it("should return a 400 error when sign-up receives an invalid email", async () => {
    const invalid = await send(
      makeService(),
      "/auth/sign-up",
      JSON.stringify({ email: "nope", password: "password" }),
    );
    expect(invalid.status).toBe(HttpStatus.BAD_REQUEST);
    expect(invalid.body).toEqual({ error: { message: "A valid email is required" } });
  });

  it("should return a 409 error when a duplicate email is submitted", async () => {
    const duplicateService = makeService();
    duplicateService.register.mockRejectedValue(
      new AppError(HttpStatus.CONFLICT, "An account with this email already exists"),
    );
    const duplicate = await send(
      duplicateService,
      "/auth/sign-up",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
    );
    expect(duplicate.status).toBe(HttpStatus.CONFLICT);
    expect(duplicate.body).toEqual({
      error: { message: "An account with this email already exists" },
    });

  });

  it("should return a 401 error when login credentials are invalid", async () => {
    const loginService = makeService();
    loginService.login.mockRejectedValue(
      new AppError(HttpStatus.UNAUTHORIZED, "Invalid email or password"),
    );
    const invalidCredentials = await send(
      loginService,
      "/auth/login",
      JSON.stringify({ email: "reader@example.com", password: "wrong-password" }),
    );
    expect(invalidCredentials.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(invalidCredentials.body).toEqual({
      error: { message: "Invalid email or password" },
    });
  });

  it("should return status code 200 with replacement tokens when refresh succeeds", async () => {
    const service = makeService();
    const refreshed = await send(
      service,
      "/auth/refresh",
      JSON.stringify({ refreshToken: "old-refresh-token" }),
    );
    expect(refreshed.status).toBe(HttpStatus.OK);
    expect(refreshed.body).toEqual(authResult);
    expect(service.refresh).toHaveBeenCalledWith("old-refresh-token");
  });

  it("should return status code 204 after logout revokes the refresh-token family", async () => {
    const service = makeService();
    const loggedOut = await send(
      service,
      "/auth/logout",
      JSON.stringify({ refreshToken: "new-refresh-token" }),
    );
    expect(loggedOut.status).toBe(HttpStatus.NO_CONTENT);
    expect(service.logout).toHaveBeenCalledWith("new-refresh-token");
  });

  it("should return a 401 error when a refresh token is invalid or expired", async () => {
    const invalidService = makeService();
    invalidService.refresh.mockRejectedValue(
      new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"),
    );
    const invalid = await send(
      invalidService,
      "/auth/refresh",
      JSON.stringify({ refreshToken: "expired-refresh-token" }),
    );
    expect(invalid.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(invalid.body).toEqual({
      error: { message: "Invalid or expired refresh token" },
    });
  });

  it("should return a 400 error when a refresh request omits its token", async () => {
    const missing = await send(makeService(), "/auth/refresh", JSON.stringify({}));
    expect(missing.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("should return a 413 error when the JSON request body exceeds the size limit", async () => {
    const response = await send(
      makeService(),
      "/auth/login",
      JSON.stringify({ extra: "x".repeat(17 * 1024) }),
    );

    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(response.body).toEqual({ error: { message: "Request body is too large" } });
  });

  it("should return a 415 error when the request uses an unsupported content encoding", async () => {
    const response = await send(
      makeService(),
      "/auth/login",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
      { "content-encoding": "compress" },
    );

    expect(response.status).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    expect(response.body).toEqual({
      error: { message: "Unsupported request encoding" },
    });
  });

  it("should return a 404 error when a request targets an unknown route", async () => {
    const notFound = await send(makeService(), "/unknown", JSON.stringify({}));
    expect(notFound.status).toBe(HttpStatus.NOT_FOUND);
    expect(notFound.body).toEqual({ error: { message: "Route not found" } });
  });

  it("should return a generic 500 error when an unexpected server error occurs", async () => {
    const service = makeService();
    service.login.mockRejectedValue(new Error("database password leaked"));
    const internal = await send(
      service,
      "/auth/login",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
    );
    expect(internal.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(internal.body).toEqual({ error: { message: "Internal server error" } });
  });
});
