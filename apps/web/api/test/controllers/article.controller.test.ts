import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { articleController } from "../../controller/article.controller.js";
import { HttpStatus } from "../../errors/appError.js";
import { articleService } from "../../service/article.service.js";

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
} as Awaited<ReturnType<typeof articleService.createArticle>>;

function makeRequest(options: {
  body?: unknown;
  params?: Record<string, string | undefined>;
  query?: Record<string, unknown>;
} = {}): Request {
  return {
    body: options.body,
    params: options.params ?? {},
    query: options.query ?? {},
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    locals: { userId },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("ArticleController", () => {
  afterEach(() => vi.restoreAllMocks());

  it("should create an article for the authenticated user with status code 201", async () => {
    const create = vi.spyOn(articleService, "createArticle").mockResolvedValue(article);
    const response = makeResponse();

    await articleController.create(
      makeRequest({ body: { title: "Example article", url: "https://example.com/article" } }),
      response,
      vi.fn(),
    );

    expect(create).toHaveBeenCalledWith(userId, {
      title: "Example article",
      url: "https://example.com/article",
      content: undefined,
    });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(response.json).toHaveBeenCalledWith(article);
  });

  it("should list the authenticated user's articles with status code 200", async () => {
    const getArticles = vi.spyOn(articleService, "getArticles").mockResolvedValue([article]);
    const response = makeResponse();

    await articleController.list(makeRequest(), response, vi.fn());

    expect(getArticles).toHaveBeenCalledWith(userId);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith([article]);
  });

  it("should get articles by ID and URL with status code 200", async () => {
    const byId = vi.spyOn(articleService, "getArticleById").mockResolvedValue(article);
    const byUrl = vi.spyOn(articleService, "getArticleByUrl").mockResolvedValue(article);
    const idResponse = makeResponse();
    const urlResponse = makeResponse();

    await articleController.getById(makeRequest({ params: { id: article.id } }), idResponse, vi.fn());
    await articleController.getByUrl(
      makeRequest({ query: { url: article.url } }),
      urlResponse,
      vi.fn(),
    );

    expect(byId).toHaveBeenCalledWith(article.id, userId);
    expect(byUrl).toHaveBeenCalledWith(article.url, userId);
    expect(idResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(idResponse.json).toHaveBeenCalledWith(article);
    expect(urlResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(urlResponse.json).toHaveBeenCalledWith(article);
  });

  it("should return not found when an article lookup has no result with status code 404", async () => {
    vi.spyOn(articleService, "getArticleById").mockResolvedValue(null);

    await expect(
      articleController.getById(makeRequest({ params: { id: article.id } }), makeResponse(), vi.fn()),
    ).rejects.toMatchObject({ statusCode: HttpStatus.NOT_FOUND, message: "Article not found" });
  });

  it("should update reading progress for the authenticated user with status code 200", async () => {
    const updated = { ...article, readingProgress: 50 };
    const update = vi.spyOn(articleService, "updateArticle").mockResolvedValue(updated);
    const response = makeResponse();

    await articleController.updateProgress(
      makeRequest({ params: { id: article.id }, body: { readingProgress: 50 } }),
      response,
      vi.fn(),
    );

    expect(update).toHaveBeenCalledWith(article.id, userId, { readingProgress: 50 });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith(updated);
  });

  it("should delete an article with status code 204", async () => {
    const remove = vi.spyOn(articleService, "deleteArticle").mockResolvedValue(true);
    const response = makeResponse();

    await articleController.remove(makeRequest({ params: { id: article.id } }), response, vi.fn());

    expect(remove).toHaveBeenCalledWith(article.id, userId);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
    expect(response.end).toHaveBeenCalledOnce();
  });

  it("should return with status code 404 when deleting a non-existent article", async () => {
    const remove = vi.spyOn(articleService, "deleteArticle").mockResolvedValue(false);

    await expect(
      articleController.remove(makeRequest({ params: { id: article.id } }), makeResponse(), vi.fn()),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      message: "Article not found",
    });

    expect(remove).toHaveBeenCalledWith(article.id, userId);
  });
});
