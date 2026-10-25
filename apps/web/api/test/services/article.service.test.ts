import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleService } from "../../service/article.service.js";
import type { ArticleModel } from "../../model/article.model.js";

describe("ArticleService", () => {
  const userId = "user-123";

  const article = {
    id: "article-123",
    userId,
    title: "Test Article",
    url: "https://example.com/article",
    domain: "example.com",
    content: null,
    readingProgress: 0,
    lastAccessedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  let model: {
    create: ReturnType<typeof vi.fn>;
    findByUserId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByUrl: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  let service: ArticleService;

  beforeEach(() => {
    model = {
      create: vi.fn(),
      findByUserId: vi.fn(),
      findById: vi.fn(),
      findByUrl: vi.fn(),
      update: vi.fn(),
    };

    service = new ArticleService(model as unknown as ArticleModel);
  });

  it("creates a new article", async () => {
    model.findByUrl.mockResolvedValue(null);
    model.create.mockResolvedValue(article);

    const result = await service.createArticle(userId, {
      title: "Test Article",
      url: "https://example.com/article",
    });

    expect(model.create).toHaveBeenCalledWith({
      userId,
      title: "Test Article",
      url: "https://example.com/article",
      domain: "example.com",
      content: undefined,
    });

    expect(result).toEqual(article);
  });

  it("rejects an article with an empty title", async () => {
    await expect(
      service.createArticle(userId, {
        title: "   ",
        url: "https://example.com/article",
      }),
    ).rejects.toThrow("Article title is required");

    expect(model.create).not.toHaveBeenCalled();
  });

  it("rejects creating duplicate articles with the same URL", async () => {
    model.findByUrl.mockResolvedValue(article);

    await expect(
      service.createArticle(userId, {
        title: "Test Article",
        url: "https://example.com/article",
      }),
    ).rejects.toThrow("Article already exists");

    expect(model.create).not.toHaveBeenCalled();
  });

  it("retrieves all articles belonging to a user", async () => {
    model.findByUserId.mockResolvedValue([article]);

    const result = await service.getArticles(userId);

    expect(model.findByUserId).toHaveBeenCalledWith(userId);
    expect(result).toEqual([article]);
  });

  it("retrieves an article by ID", async () => {
    model.findById.mockResolvedValue(article);

    const result = await service.getArticleById(article.id, userId);

    expect(model.findById).toHaveBeenCalledWith(article.id, userId);

    expect(result).toEqual(article);
  });

  it("normalizes URLs before searching", async () => {
    model.findByUrl.mockResolvedValue(article);

    await service.getArticleByUrl(
      "https://example.com/article#section",
      userId,
    );

    expect(model.findByUrl).toHaveBeenCalledWith(
      "https://example.com/article",
      userId,
    );
  });

  it("updates article reading progress", async () => {
    const updatedArticle = {
      ...article,
      readingProgress: 75,
    };

    model.update.mockResolvedValue(updatedArticle);

    const result = await service.updateArticle(article.id, userId, {
      readingProgress: 75,
    });

    expect(model.update).toHaveBeenCalledWith(article.id, userId, {
      readingProgress: 75,
    });

    expect(result?.readingProgress).toBe(75);
  });
});
