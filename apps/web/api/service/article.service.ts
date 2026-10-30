import {
  ArticleModel,
  type UpdateArticleInput,
} from "../model/article.model.js";

import { AppError, HttpStatus } from "../errors/appError.js";
import {
  getArticleDomain,
  isArticleUrlUniqueViolation,
  normalizeUrl,
} from "../utils/article.utils.js";

export interface CreateArticleRequest {
  title: string;
  url: string;
  content?: string;
}

export class ArticleService {
  constructor(private readonly articleModel: ArticleModel) {}

  async createArticle(userId: string, input: CreateArticleRequest) {
    if (!input.title?.trim()) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Article title is required");
    }

    const url = normalizeUrl(input.url);
    const domain = getArticleDomain(url);

    const existingArticle = await this.articleModel.findByUrl(url, userId);

    if (existingArticle) {
      throw new AppError(HttpStatus.CONFLICT, "Article already exists");
    }

    try {
      return await this.articleModel.create({
        userId,
        title: input.title.trim(),
        url,
        domain,
        content: input.content,
      });
    } catch (error) {
      if (isArticleUrlUniqueViolation(error)) {
        throw new AppError(HttpStatus.CONFLICT, "Article already exists");
      }
      throw error;
    }
  }

  async getArticles(userId: string) {
    return this.articleModel.findByUserId(userId);
  }

  async getArticleById(id: string, userId: string) {
    const article = await this.articleModel.findById(id);

    if (!article || article.userId !== userId) {
      return null;
    }

    return article;
  }

  async getArticleByUrl(url: string, userId: string) {
    const normalizedUrl = normalizeUrl(url);

    return this.articleModel.findByUrl(normalizedUrl, userId);
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
    return this.articleModel.update(id, userId, input);
  }

  async deleteArticle(id: string, userId: string): Promise<boolean> {
    return this.articleModel.delete(id, userId);
  }
}
