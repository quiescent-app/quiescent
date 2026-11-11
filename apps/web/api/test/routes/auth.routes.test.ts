import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { RequestHandler } from "express";

import { createApp } from "../../app.js";
import { HttpStatus } from "../../errors/appError.js";

const authResult = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "reader@example.com",
    displayName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  accessToken: "access-token",
};

const { authControllerMock } = vi.hoisted(() => {
  const result = {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "reader@example.com",
      displayName: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    accessToken: "access-token",
  };

  return {
    authControllerMock: {
      signUp: vi.fn<RequestHandler>((_req, res) => { res.status(201).json(result); }),
      login: vi.fn<RequestHandler>((_req, res) => { res.status(200).json(result); }),
      refresh: vi.fn<RequestHandler>((_req, res) => { res.status(200).json(result); }),
      logout: vi.fn<RequestHandler>((_req, res) => { res.status(204).end(); }),
    },
  };
});

vi.mock("../../controller/auth.controller.js", () => ({
  authController: authControllerMock,
}));

describe("authentication routes", () => {
  const webOrigin = "http://localhost:5173";
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  async function send(
    path: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<request.Response> {
    return request(createApp())
      .post(path)
      .set({ "content-type": "application/json", ...headers })
      .send(body);
  }

  it("should dispatch valid sign-up credentials to the controller with status code 201", async () => {
    const response = await send(
      "/auth/sign-up",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
      { origin: webOrigin },
    );

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toEqual(authResult);
    expect(authControllerMock.signUp).toHaveBeenCalledOnce();
    expect(authControllerMock.signUp.mock.calls[0]?.[0].body).toEqual({
      email: "reader@example.com",
      password: "correct-password",
    });
  });

  it("should dispatch valid login credentials to the controller with status code 200", async () => {
    const response = await send(
      "/auth/login",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
      { origin: webOrigin },
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual(authResult);
    expect(authControllerMock.login).toHaveBeenCalledOnce();
    expect(authControllerMock.login.mock.calls[0]?.[0].body).toEqual({
      email: "reader@example.com",
      password: "correct-password",
    });
  });

  it("should dispatch a valid refresh token to the controller with status code 200", async () => {
    const response = await send(
      "/auth/refresh",
      JSON.stringify({ refreshToken: "ignored-body-token" }),
      { origin: webOrigin, cookie: "quiescent_refresh=old-refresh-token" },
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(authControllerMock.refresh).toHaveBeenCalledOnce();
    expect(authControllerMock.refresh.mock.calls[0]?.[0].body).toEqual({
      refreshToken: "old-refresh-token",
    });
  });

  it("should dispatch a valid logout token to the controller with status code 204", async () => {
    const response = await send(
      "/auth/logout",
      JSON.stringify({ refreshToken: "ignored-body-token" }),
      { origin: webOrigin, cookie: "quiescent_refresh=refresh-token" },
    );

    expect(response.status).toBe(HttpStatus.NO_CONTENT);
    expect(authControllerMock.logout).toHaveBeenCalledOnce();
    expect(authControllerMock.logout.mock.calls[0]?.[0].body).toEqual({
      refreshToken: "refresh-token",
    });
  });

  it("should reject logout from an untrusted origin", async () => {
    const response = await send("/auth/logout", "{}", {
      origin: "https://attacker.example",
      cookie: "quiescent_refresh=refresh-token",
    });

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(authControllerMock.logout).not.toHaveBeenCalled();
  });

  it("should reject refresh when the cookie is missing", async () => {
    const response = await send("/auth/refresh", "{}", { origin: webOrigin });

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(authControllerMock.refresh).not.toHaveBeenCalled();
  });

  it("should reject cookie refresh from an untrusted origin", async () => {
    const response = await send("/auth/refresh", "{}", {
      origin: "https://attacker.example",
      cookie: "quiescent_refresh=refresh-token",
    });

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(authControllerMock.refresh).not.toHaveBeenCalled();
  });

  it("should return status code 400 without calling the controller when the JSON body is malformed", async () => {
    const malformed = await send("/auth/sign-up", "{");

    expect(malformed.status).toBe(HttpStatus.BAD_REQUEST);
    expect(malformed.body).toEqual({
      error: { message: "Request body must contain valid JSON" },
    });
    expect(authControllerMock.signUp).not.toHaveBeenCalled();
  });

  it("should return status code 400 without calling the controller when sign-up receives an invalid email", async () => {
    const invalid = await send(
      "/auth/sign-up",
      JSON.stringify({ email: "nope", password: "password" }),
      { origin: webOrigin },
    );

    expect(invalid.status).toBe(HttpStatus.BAD_REQUEST);
    expect(invalid.body).toEqual({ error: { message: "A valid email is required" } });
    expect(authControllerMock.signUp).not.toHaveBeenCalled();
  });

  it("should return status code 400 without calling the controller when a refresh request omits its token", async () => {
    const missing = await send("/auth/refresh", JSON.stringify({}), { origin: webOrigin });

    expect(missing.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(missing.body).toEqual({ error: { message: "Invalid or expired refresh token" } });
    expect(authControllerMock.refresh).not.toHaveBeenCalled();
  });

  it("should return status code 413 when the JSON request body exceeds the size limit", async () => {
    const response = await send(
      "/auth/login",
      JSON.stringify({ extra: "x".repeat(17 * 1024) }),
    );

    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(response.body).toEqual({ error: { message: "Request body is too large" } });
    expect(authControllerMock.login).not.toHaveBeenCalled();
  });

  it("should return status code 415 when the request uses an unsupported content encoding", async () => {
    const response = await send(
      "/auth/login",
      JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
      { "content-encoding": "compress" },
    );

    expect(response.status).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    expect(response.body).toEqual({ error: { message: "Unsupported request encoding" } });
    expect(authControllerMock.login).not.toHaveBeenCalled();
  });

  it("should return status code 404 for an unknown route", async () => {
    const response = await send("/unknown", JSON.stringify({}));

    expect(response.status).toBe(HttpStatus.NOT_FOUND);
    expect(response.body).toEqual({ error: { message: "Route not found" } });
  });
});
