import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { AppError, HttpStatus } from "../../errors/appError.js";
import { ArticleService } from "../../service/article.service.js";
import { AuthService } from "../../service/auth.service.js";
import { createAccessToken } from "../../utils/token.utils.js";

const userId = "00000000-0000-4000-8000-000000000001";
const article = {
  id: "00000000-0000-4000-8000-000000000002",
  userId,
  title: "Example article",
  url: "https://example.com/article",
  domain: "example.com",
  content: null,
  readingProgress: 0,
  lastAccessedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  completedAt: null,
};
const articleResponse = {
  ...article,
  lastAccessedAt: article.lastAccessedAt.toISOString(),
  createdAt: article.createdAt.toISOString(),
  updatedAt: article.updatedAt.toISOString(),
};
const jwtSecret = new TextEncoder().encode("test-secret-that-is-at-least-32-bytes");

function makeArticleService() {
  return {
    createArticle: vi.fn(async () => article),
    getArticles: vi.fn(async () => [article]),
    getArticleById: vi.fn(async (): Promise<typeof article | null> => article),
    getArticleByUrl: vi.fn(async () => article),
    updateArticle: vi.fn(async () => ({ ...article, readingProgress: 50 })),
    deleteArticle: vi.fn(async () => true),
  };
}

function makeAuthService() {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  };
}

describe("article routes", () => {
  let accessToken: string;

  beforeEach(async () => {
    accessToken = await createAccessToken(userId, jwtSecret);
  });

  async function send(
    service: ReturnType<typeof makeArticleService>,
    method: string,
    path: string,
    body?: unknown,
    token: string | null = accessToken,
  ): Promise<request.Response> {
    const app = createApp(
      makeAuthService() as unknown as AuthService,
      service as unknown as ArticleService,
      jwtSecret,
    );
    const methodName = method.toLowerCase() as "get" | "post" | "patch" | "delete";
    let test = request(app)[methodName](path);
    if (body !== undefined && body !== null) test = test.send(body as object | string);
    if (token) test = test.set("Authorization", `Bearer ${token}`);
    return test;
  }

  it("should return 401 when a request omits its access token", async () => {
    const response = await send(makeArticleService(), "GET", "/articles", undefined, null);

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(response.body).toEqual({ error: { message: "Authentication required" } });
  });

  it("should return 201 and create an article for the authenticated user", async () => {
    const service = makeArticleService();
    const response = await send(service, "POST", "/articles", {
      title: "Example article",
      url: "https://example.com/article",
    });

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toEqual(articleResponse);
    expect(service.createArticle).toHaveBeenCalledWith(userId, {
      title: "Example article",
      url: "https://example.com/article",
      content: undefined,
    });
  });

  it("should return 400 when article creation has an invalid payload", async () => {
    const response = await send(makeArticleService(), "POST", "/articles", {
      title: " ",
      url: "https://example.com/article",
    });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({ error: { message: "Article title is required" } });
  });

  it("should return 409 when the authenticated user submits a duplicate article", async () => {
    const service = makeArticleService();
    service.createArticle.mockRejectedValue(
      new AppError(HttpStatus.CONFLICT, "Article already exists"),
    );
    const response = await send(service, "POST", "/articles", {
      title: article.title,
      url: article.url,
    });

    expect(response.status).toBe(HttpStatus.CONFLICT);
    expect(response.body).toEqual({ error: { message: "Article already exists" } });
  });

  it("should return 200 with only the authenticated user's articles", async () => {
    const service = makeArticleService();
    const response = await send(service, "GET", "/articles");

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual([articleResponse]);
    expect(service.getArticles).toHaveBeenCalledWith(userId);
  });

  it("should return 200 when retrieving an article by ID or URL", async () => {
    const service = makeArticleService();
    const byId = await send(service, "GET", `/articles/${article.id}`);
    const byUrl = await send(
      service,
      "GET",
      `/articles/by-url?url=${encodeURIComponent(article.url)}`,
    );

    expect(byId.status).toBe(HttpStatus.OK);
    expect(byId.body).toEqual(articleResponse);
    expect(service.getArticleById).toHaveBeenCalledWith(article.id, userId);
    expect(byUrl.status).toBe(HttpStatus.OK);
    expect(byUrl.body).toEqual(articleResponse);
    expect(service.getArticleByUrl).toHaveBeenCalledWith(article.url, userId);
  });

  it("should return 404 when an article does not exist or belongs to another user", async () => {
    const service = makeArticleService();
    service.getArticleById.mockResolvedValue(null);
    const response = await send(service, "GET", `/articles/${article.id}`);

    expect(response.status).toBe(HttpStatus.NOT_FOUND);
    expect(response.body).toEqual({ error: { message: "Article not found" } });
  });

  it("should return 200 when updating reading progress", async () => {
    const service = makeArticleService();
    const response = await send(service, "PATCH", `/articles/${article.id}`, {
      readingProgress: 50,
    });

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual({ ...articleResponse, readingProgress: 50 });
    expect(service.updateArticle).toHaveBeenCalledWith(article.id, userId, {
      readingProgress: 50,
    });
  });

  it("should return 400 when reading progress is outside the valid range", async () => {
    const service = makeArticleService();
    service.updateArticle.mockRejectedValue(
      new AppError(
        HttpStatus.BAD_REQUEST,
        "Reading progress must be an integer between 0 and 100",
      ),
    );
    const response = await send(service, "PATCH", `/articles/${article.id}`, {
      readingProgress: 101,
    });

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.body).toEqual({
      error: { message: "Reading progress must be an integer between 0 and 100" },
    });
  });

  it("should return 204 after deleting an article owned by the authenticated user", async () => {
    const service = makeArticleService();
    const response = await send(service, "DELETE", `/articles/${article.id}`);

    expect(response.status).toBe(HttpStatus.NO_CONTENT);
    expect(service.deleteArticle).toHaveBeenCalledWith(article.id, userId);
  });
});
