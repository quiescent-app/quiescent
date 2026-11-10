import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleService } from "../../service/article.service.js";
import { HttpStatus } from "../../errors/appError.js";

const mocks = vi.hoisted(() => ({
  articleModel: {
    create: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    findByUrl: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../model/article.model.js", () => ({
  articleModel: mocks.articleModel,
}));

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

  let service: ArticleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ArticleService();
  });

  it("should create and return a new article", async () => {
    mocks.articleModel.findByUrl.mockResolvedValue(null);
    mocks.articleModel.create.mockResolvedValue(article);

    const result = await service.createArticle(userId, {
      title: "Test Article",
      url: "https://example.com/article",
    });

    expect(mocks.articleModel.create).toHaveBeenCalledWith({
      userId,
      title: "Test Article",
      url: "https://example.com/article",
      domain: "example.com",
      content: undefined,
    });

    expect(result).toEqual(article);
  });

  it("should reject creating a duplicate article with status code 409", async () => {
    mocks.articleModel.findByUrl.mockResolvedValue(article);

    await expect(
      service.createArticle(userId, {
        title: "Test Article",
        url: "https://example.com/article",
      }),
    ).rejects.toThrow("Article already exists");

    expect(mocks.articleModel.create).not.toHaveBeenCalled();
  });

  it("should retrieve all articles belonging to a user", async () => {
    mocks.articleModel.findByUserId.mockResolvedValue([article]);

    const result = await service.getArticles(userId);

    expect(mocks.articleModel.findByUserId).toHaveBeenCalledWith(userId);
    expect(result).toEqual([article]);
  });

  it("should retrieve an article by ID", async () => {
    mocks.articleModel.findById.mockResolvedValue(article);

    const result = await service.getArticleById(article.id, userId);

    expect(mocks.articleModel.findById).toHaveBeenCalledWith(article.id);

    expect(result).toEqual(article);
  });

  it("should reject access to another user's article by ID with status code 403", async () => {
    mocks.articleModel.findById.mockResolvedValue({
      ...article,
      userId: "other-user-456",
    });

    await expect(service.getArticleById(article.id, userId)).rejects.toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
    });

    expect(mocks.articleModel.findById).toHaveBeenCalledWith(article.id);
  });

  it("should reject a missing article with status code 404", async () => {
    mocks.articleModel.findById.mockResolvedValue(null);

    await expect(service.getArticleById(article.id, userId)).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
    });

    expect(mocks.articleModel.findById).toHaveBeenCalledWith(article.id);
  });

  it("should normalize URLs before searching", async () => {
    mocks.articleModel.findByUrl.mockResolvedValue(article);

    await service.getArticleByUrl(
      "https://example.com/article#section",
      userId,
    );

    expect(mocks.articleModel.findByUrl).toHaveBeenCalledWith(
      "https://example.com/article",
      userId,
    );
  });

  it("should reject access to another user's article by URL with status code 403", async () => {
    mocks.articleModel.findByUrl.mockResolvedValue({
      ...article,
      userId: "other-user-456",
    });

    await expect(
      service.getArticleByUrl("https://example.com/article#section", userId),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
      message: "You do not have permission to access this article",
    });

    expect(mocks.articleModel.findByUrl).toHaveBeenCalledWith(
      "https://example.com/article",
      userId,
    );
  });

  it("should update article reading progress", async () => {
    const updatedArticle = {
      ...article,
      readingProgress: 75,
    };

    mocks.articleModel.update.mockResolvedValue(updatedArticle);

    const result = await service.updateArticle(article.id, userId, {
      readingProgress: 75,
    });

    expect(mocks.articleModel.update).toHaveBeenCalledWith(article.id, userId, {
      readingProgress: 75,
    });

    expect(result?.readingProgress).toBe(75);
  });

  it.each([-1, 101, 50.5])(
    "should reject invalid reading progress with status code 400: %s",
    async (readingProgress) => {
      await expect(
        service.updateArticle(article.id, userId, {
          readingProgress,
        }),
      ).rejects.toThrow(
        "Reading progress must be an integer between 0 and 100",
      );

      expect(mocks.articleModel.update).not.toHaveBeenCalled();
    },
  );

  it("should delete an article", async () => {
    mocks.articleModel.delete.mockResolvedValue(true);

    const result = await service.deleteArticle(article.id, userId);

    expect(mocks.articleModel.delete).toHaveBeenCalledWith(article.id, userId);
    expect(result).toBe(true);
  });

  it("should reject updating a missing or inaccessible article with status code 404", async () => {
    mocks.articleModel.update.mockResolvedValue(null);

    await expect(
      service.updateArticle(article.id, userId, { readingProgress: 75 }),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      message: "Article not found",
    });

    expect(mocks.articleModel.update).toHaveBeenCalledWith(article.id, userId, {
      readingProgress: 75,
    });
  });

  it("should reject deleting a missing or inaccessible article with status code 404", async () => {
    mocks.articleModel.delete.mockResolvedValue(false);

    await expect(service.deleteArticle(article.id, userId)).rejects.toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      message: "Article not found",
    });

    expect(mocks.articleModel.delete).toHaveBeenCalledWith(article.id, userId);
  });
});
