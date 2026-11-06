import type { RequestHandler } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { HttpStatus } from "../../errors/appError.js";
import { createAccessToken } from "../../utils/token.utils.js";

const articleId = "00000000-0000-4000-8000-000000000002";

const { articleControllerMock } = vi.hoisted(() => {
  function respond(status: number, body?: unknown): RequestHandler {
    return (_req, res) => {
      if (body === undefined) res.status(status).end();
      else res.status(status).json(body);
    };
  }

  return {
    articleControllerMock: {
      create: vi.fn<RequestHandler>(respond(201, { id: "article-id" })),
      list: vi.fn<RequestHandler>(respond(200, [{ id: "article-id" }])),
      getById: vi.fn<RequestHandler>(respond(200, { id: "article-id" })),
      getByUrl: vi.fn<RequestHandler>(respond(200, { id: "article-id" })),
      updateProgress: vi.fn<RequestHandler>(respond(200, { readingProgress: 50 })),
      remove: vi.fn<RequestHandler>(respond(204)),
    },
  };
});

vi.mock("../../controller/article.controller.js", () => ({
  articleController: articleControllerMock,
}));

describe("article routes", () => {
  let accessToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    accessToken = await createAccessToken("00000000-0000-4000-8000-000000000001");
  });
  afterEach(() => vi.restoreAllMocks());

  function send(method: "get" | "post" | "patch" | "delete", path: string, body?: unknown) {
    let test = request(createApp())[method](path);
    test = test.set("Authorization", `Bearer ${accessToken}`);
    if (body !== undefined) test = test.send(body as object | string);
    return test;
  }

  it("should require authentication before dispatching to a controller with status code 401", async () => {
    const response = await request(createApp()).get("/articles");

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(response.body).toEqual({ error: { message: "Authentication required" } });
    expect(articleControllerMock.list).not.toHaveBeenCalled();
  });

  it("should dispatch GET /articles to the list controller with status code 200", async () => {
    const response = await send("get", "/articles");

    expect(response.status).toBe(HttpStatus.OK);
    expect(articleControllerMock.list).toHaveBeenCalledOnce();
  });

  it("should dispatch POST /articles to the create controller with status code 201", async () => {
    const response = await send("post", "/articles", {
      title: "Example article",
      url: "https://example.com",
    });

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(articleControllerMock.create).toHaveBeenCalledOnce();
  });

  it("should dispatch GET /articles/by-url to the getByUrl controller with status code 200", async () => {
    const response = await send("get", "/articles/by-url?url=https%3A%2F%2Fexample.com");

    expect(response.status).toBe(HttpStatus.OK);
    expect(articleControllerMock.getByUrl).toHaveBeenCalledOnce();
  });

  it("should dispatch GET /articles/:id to the getById controller with status code 200", async () => {
    const response = await send("get", `/articles/${articleId}`);

    expect(response.status).toBe(HttpStatus.OK);
    expect(articleControllerMock.getById).toHaveBeenCalledOnce();
  });

  it("should dispatch PATCH /articles/:id to the updateProgress controller with status code 200", async () => {
    const response = await send("patch", `/articles/${articleId}`, { readingProgress: 50 });

    expect(response.status).toBe(HttpStatus.OK);
    expect(articleControllerMock.updateProgress).toHaveBeenCalledOnce();
  });

  it("should dispatch DELETE /articles/:id to the remove controller with status code 204", async () => {
    const response = await send("delete", `/articles/${articleId}`);

    expect(response.status).toBe(HttpStatus.NO_CONTENT);
    expect(articleControllerMock.remove).toHaveBeenCalledOnce();
  });

  it("should reject a blank article title before dispatching with status code 400", async () => {
    const response = await send("post", "/articles", {
      title: " ",
      url: "https://example.com",
    });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Article title is required" } });
    expect(articleControllerMock.create).not.toHaveBeenCalled();
  });

  it("should reject a blank article URL before dispatching with status code 400", async () => {
    const response = await send("post", "/articles", { title: "Title", url: " " });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Article URL is required" } });
    expect(articleControllerMock.create).not.toHaveBeenCalled();
  });

  it("should reject non-string article content before dispatching with status code 400", async () => {
    const response = await send("post", "/articles", {
      title: "Title",
      url: "https://example.com",
      content: 5,
    });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Article content must be a string" } });
    expect(articleControllerMock.create).not.toHaveBeenCalled();
  });

  it("should reject a missing URL query before dispatching with status code 400", async () => {
    const response = await send("get", "/articles/by-url");

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Article URL query parameter is required" } });
    expect(articleControllerMock.getByUrl).not.toHaveBeenCalled();
  });

  it("should reject an invalid article ID before dispatching with status code 400", async () => {
    const response = await send("get", "/articles/not-a-uuid");

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Article ID must be a valid UUID" } });
    expect(articleControllerMock.getById).not.toHaveBeenCalled();
  });

  it("should reject non-number reading progress before dispatching with status code 400", async () => {
    const response = await send("patch", `/articles/${articleId}`, { readingProgress: "50" });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Reading progress must be a number" } });
    expect(articleControllerMock.updateProgress).not.toHaveBeenCalled();
  });
});
