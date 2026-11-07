import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleModel } from "../../model/article.model.js";
import { UserModel } from "../../model/user.model.js";
import { createTestDatabase } from "../database/database.js";

const databaseState = vi.hoisted(() => ({
  current: undefined as Record<PropertyKey, unknown> | undefined,
}));

vi.mock("../../db/client.js", () => ({
  database: new Proxy(
    {},
    {
      get(_target, property) {
        const current = databaseState.current;
        if (!current) throw new Error("Test database has not been initialized");
        const value = Reflect.get(current, property, current) as unknown;
        return typeof value === "function" ? value.bind(current) : value;
      },
    },
  ),
}));

describe("ArticleModel", () => {
  let client: PGlite;
  let articleModel: ArticleModel;
  let userModel: UserModel;
  let userId: string;
  let otherUserId: string;

  beforeEach(async () => {
    const testDatabase = await createTestDatabase();
    client = testDatabase.client;
    databaseState.current = testDatabase.database as unknown as Record<PropertyKey, unknown>;
    articleModel = new ArticleModel();
    userModel = new UserModel();

    const user = await userModel.create({
      email: "test@example.com",
      password: "stored-hash",
    });

    const otherUser = await userModel.create({
      email: "other@example.com",
      password: "stored-hash",
    });

    userId = user.id;
    otherUserId = otherUser.id;
  });

  afterEach(async () => {
    if (client) await client.close();
    databaseState.current = undefined;
  });

  const articleInput = {
    title: "Introduction to TypeScript",
    url: "https://example.com/typescript",
    domain: "example.com",
  };

  describe("create", () => {
    it("should create an article with default values", async () => {
      const article = await articleModel.create({
        ...articleInput,
        userId,
      });

      expect(article.id).toBeDefined();
      expect(article.userId).toBe(userId);
      expect(article.title).toBe(articleInput.title);
      expect(article.url).toBe(articleInput.url);
      expect(article.domain).toBe(articleInput.domain);
      expect(article.readingProgress).toBe(0);
      expect(article.content).toBeNull();
      expect(article.completedAt).toBeNull();
      expect(article.createdAt).toBeInstanceOf(Date);
      expect(article.updatedAt).toBeInstanceOf(Date);
    });

    it("should create an article with content", async () => {
      const article = await articleModel.create({
        ...articleInput,
        userId,
        content: "This is the article content.",
      });

      expect(article.content).toBe("This is the article content.");
    });

    it("should prevent duplicate URLs for the same user", async () => {
      await articleModel.create({ ...articleInput, userId });

      await expect(
        articleModel.create({ ...articleInput, userId }),
      ).rejects.toMatchObject({
        cause: { code: "23505" },
      });
    });

    it("should allow different users to save the same URL", async () => {
      const first = await articleModel.create({
        ...articleInput,
        userId,
      });

      const second = await articleModel.create({
        ...articleInput,
        userId: otherUserId,
      });

      expect(first.id).not.toBe(second.id);
      expect(first.url).toBe(second.url);
    });
  });

  describe("findByUserId", () => {
    it("should return only articles belonging to the user", async () => {
      await articleModel.create({
        ...articleInput,
        userId,
      });

      await articleModel.create({
        ...articleInput,
        userId: otherUserId,
      });

      const articles = await articleModel.findByUserId(userId);

      expect(articles).toHaveLength(1);
      expect(articles[0]?.userId).toBe(userId);
    });

    it("should return an empty array when the user has no articles", async () => {
      const articles = await articleModel.findByUserId(userId);

      expect(articles).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should find an article by ID", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const article = await articleModel.findById(created.id);

      expect(article?.id).toBe(created.id);
      expect(article?.title).toBe(articleInput.title);
    });

    it("should return null when the article does not exist", async () => {
      const article = await articleModel.findById(
        "00000000-0000-4000-8000-000000000000",
      );

      expect(article).toBeNull();
    });

    it("should find an article by its ID", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId: otherUserId,
      });

      const article = await articleModel.findById(created.id);

      expect(article?.id).toBe(created.id);
      expect(article?.userId).toBe(otherUserId);
    });
  });

  describe("findByUrl", () => {
    it("should find an article by URL", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const article = await articleModel.findByUrl(articleInput.url, userId);

      expect(article?.id).toBe(created.id);
    });

    it("should return null when the URL does not exist", async () => {
      const article = await articleModel.findByUrl(
        "https://example.com/not-found",
        userId,
      );

      expect(article).toBeNull();
    });

    it("should prevent accessing another user's article by URL", async () => {
      await articleModel.create({
        ...articleInput,
        userId,
      });

      const article = await articleModel.findByUrl(
        articleInput.url,
        otherUserId,
      );

      expect(article).toBeNull();
    });
  });

  describe("update", () => {
    it("should update the reading progress", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const updated = await articleModel.update(created.id, userId, {
        readingProgress: 50,
      });

      expect(updated?.readingProgress).toBe(50);
      expect(updated?.completedAt).toBeNull();
      expect(updated?.updatedAt).toBeInstanceOf(Date);
      expect(updated?.lastAccessedAt).toBeInstanceOf(Date);
    });

    it("should set completedAt when progress reaches 100", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const updated = await articleModel.update(created.id, userId, {
        readingProgress: 100,
      });

      expect(updated?.readingProgress).toBe(100);
      expect(updated?.completedAt).toBeInstanceOf(Date);
    });

    it("should clear completedAt when progress drops below 100", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      await articleModel.update(created.id, userId, {
        readingProgress: 100,
      });

      const updated = await articleModel.update(created.id, userId, {
        readingProgress: 75,
      });

      expect(updated?.readingProgress).toBe(75);
      expect(updated?.completedAt).toBeNull();
    });

    it("should return null when updating another user's article", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const updated = await articleModel.update(created.id, otherUserId, {
        readingProgress: 50,
      });

      expect(updated).toBeNull();

      const original = await articleModel.findById(created.id);

      expect(original?.readingProgress).toBe(0);
    });

    it("should return null when updating a nonexistent article", async () => {
      const updated = await articleModel.update(
        "00000000-0000-4000-8000-000000000000",
        userId,
        { readingProgress: 50 },
      );

      expect(updated).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete an existing article", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const deleted = await articleModel.delete(created.id, userId);

      expect(deleted).toBe(true);

      const article = await articleModel.findById(created.id);

      expect(article).toBeNull();
    });

    it("should prevent deleting another user's article", async () => {
      const created = await articleModel.create({
        ...articleInput,
        userId,
      });

      const deleted = await articleModel.delete(created.id, otherUserId);

      expect(deleted).toBe(false);

      const article = await articleModel.findById(created.id);

      expect(article).not.toBeNull();
    });

    it("should return false when deleting a nonexistent article", async () => {
      const deleted = await articleModel.delete(
        "00000000-0000-4000-8000-000000000000",
        userId,
      );

      expect(deleted).toBe(false);
    });
  });
});
