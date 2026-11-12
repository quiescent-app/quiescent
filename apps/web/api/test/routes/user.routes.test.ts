import type { RequestHandler } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import { HttpStatus } from "../../errors/appError.js";
import { createAccessToken } from "../../utils/token.utils.js";

const userId = "00000000-0000-4000-8000-000000000001";

const { userControllerMock } = vi.hoisted(() => {
  function respond(status: number): RequestHandler {
    return (_req, res) => res.status(status).json({ id: "profile-user" });
  }
  return {
    userControllerMock: {
      getProfile: vi.fn<RequestHandler>(respond(200)),
      updateProfile: vi.fn<RequestHandler>(respond(200)),
    },
  };
});

vi.mock("../../controller/user.controller.js", () => ({ userController: userControllerMock }));

describe("user profile routes", () => {
  let accessToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    accessToken = await createAccessToken(userId);
  });
  afterEach(() => vi.restoreAllMocks());

  function send(method: "get" | "patch", body?: unknown) {
    let test = request(createApp())[method]("/users/me").set(
      "Authorization",
      `Bearer ${accessToken}`,
    );
    if (body !== undefined) test = test.send(body as object | string);
    return test;
  }

  it("requires authentication for GET /users/me", async () => {
    const response = await request(createApp()).get("/users/me");

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(userControllerMock.getProfile).not.toHaveBeenCalled();
  });

  it("dispatches an authenticated profile read", async () => {
    const response = await send("get");

    expect(response.status).toBe(HttpStatus.OK);
    expect(userControllerMock.getProfile).toHaveBeenCalledOnce();
  });

  it("dispatches only the display name for an authenticated profile update", async () => {
    const response = await send("patch", { displayName: "Reader One", userId: "attacker" });

    expect(response.status).toBe(HttpStatus.OK);
    expect(userControllerMock.updateProfile).toHaveBeenCalledOnce();
    expect(userControllerMock.updateProfile.mock.calls[0]?.[0].body).toEqual({
      displayName: "Reader One",
    });
  });

  it.each([null, [], "not-an-object", {}, { displayName: 123 }])(
    "rejects malformed profile update bodies",
    async (body) => {
      const response = await send("patch", body);
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(userControllerMock.updateProfile).not.toHaveBeenCalled();
    },
  );
});
