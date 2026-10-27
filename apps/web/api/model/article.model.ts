import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  articles,
  type ArticleRecord,
  type NewArticleRecord,
} from "../schema/article.schema.js";

export type CreateArticleInput = Pick<
  NewArticleRecord,
  "userId" | "title" | "url" | "domain"
> &
  Partial<Pick<NewArticleRecord, "content">>;

export type UpdateArticleInput = Pick<ArticleRecord, "readingProgress">;

export class ArticleModel {
  constructor(private readonly database: Database) {}

  async create(input: CreateArticleInput): Promise<ArticleRecord> {
    const [article] = await this.database
      .insert(articles)
      .values({
        ...input,
        readingProgress: 0,
      })
      .returning();

    if (!article) {
      throw new Error("Article insert did not return a record");
    }

    return article;
  }

  async findByUserId(userId: string): Promise<ArticleRecord[]> {
    return this.database
      .select()
      .from(articles)
      .where(eq(articles.userId, userId))
      .orderBy(desc(articles.lastAccessedAt));
  }

  async findById(id: string): Promise<ArticleRecord | null> {
    const [article] = await this.database
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    return article ?? null;
  }

  async findByUrl(url: string, userId: string): Promise<ArticleRecord | null> {
    const [article] = await this.database
      .select()
      .from(articles)
      .where(and(eq(articles.url, url), eq(articles.userId, userId)))
      .limit(1);

    return article ?? null;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateArticleInput,
  ): Promise<ArticleRecord | null> {
    const { readingProgress } = input;
    const now = new Date();

    const [article] = await this.database
      .update(articles)
      .set({
        readingProgress,
        lastAccessedAt: now,
        updatedAt: now,
        completedAt: readingProgress === 100 ? now : null,
      })
      .where(and(eq(articles.id, id), eq(articles.userId, userId)))
      .returning();

    return article ?? null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const deleted = await this.database
      .delete(articles)
      .where(and(eq(articles.id, id), eq(articles.userId, userId)))
      .returning({ id: articles.id });

    return deleted.length > 0;
  }
}
