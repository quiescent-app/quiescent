import { AppError, HttpStatus } from "../errors/appError.js";

import {
  articleModel,
  type UpdateArticleInput,
} from "../model/article.model.js";

import { normalizeArticleUrl, getArticleDomain } from "../utils/article-url.js";

export interface CreateArticleRequest {
  title: string;
  url: string;
  content?: string;
}

export class ArticleService {

  async createArticle(userId: string, input: CreateArticleRequest) {
    const url = normalizeArticleUrl(input.url);
    const domain = getArticleDomain(url);

    const existingArticle = await articleModel.findByUrl(url, userId);

    if (existingArticle) {
      throw new AppError(HttpStatus.CONFLICT, "Article already exists");
    }

    return articleModel.create({
      userId,
      title: input.title.trim(),
      url,
      domain,
      content: input.content,
    });
  }

  async getArticles(userId: string) {
    return articleModel.findByUserId(userId);
  }

  async getArticleById(id: string, userId: string) {
    const article = await articleModel.findById(id);

    if (!article) {
      throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    }

    if (article.userId !== userId) {
      throw new AppError(HttpStatus.FORBIDDEN, "You do not have permission to access this article");
    }

    return article;
  }

  async getArticleByUrl(url: string, userId: string) {
    const normalizedUrl = normalizeArticleUrl(url);

    const article = await articleModel.findByUrl(normalizedUrl, userId);

    if (!article) {
      throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    }

    if (article.userId !== userId) {
      throw new AppError(HttpStatus.FORBIDDEN, "You do not have permission to access this article");
    }

    return article;
  }

  async updateArticle(id: string, userId: string, input: UpdateArticleInput) {
    const { readingProgress } = input;

    if (
      !Number.isInteger(readingProgress) ||
      readingProgress < 0 ||
      readingProgress > 100
    ) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "Reading progress must be an integer between 0 and 100",
      );
    }
    const article = await articleModel.update(id, userId, input);
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    return article;
  }

  async deleteArticle(id: string, userId: string): Promise<boolean> {
    const deleted = await articleModel.delete(id, userId);
    if (!deleted) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    return deleted;
  }
}

export const articleService = new ArticleService();
