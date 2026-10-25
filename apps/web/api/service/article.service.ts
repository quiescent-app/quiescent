import {
  ArticleModel,
  type UpdateArticleInput,
} from "../model/article.model.js";

import { normalizeArticleUrl, getArticleDomain } from "../utils/article-url.js";

export interface CreateArticleRequest {
  title: string;
  url: string;
  content?: string;
}

export class ArticleService {
  constructor(private readonly articleModel: ArticleModel) {}

  async createArticle(userId: string, input: CreateArticleRequest) {
    if (!input.title?.trim()) {
      throw new Error("Article title is required");
    }

    const url = normalizeArticleUrl(input.url);
    const domain = getArticleDomain(url);

    const existingArticle = await this.articleModel.findByUrl(url, userId);

    if (existingArticle) {
      throw new Error("Article already exists");
    }

    return this.articleModel.create({
      userId,
      title: input.title.trim(),
      url,
      domain,
      content: input.content,
    });
  }

  async getArticles(userId: string) {
    return this.articleModel.findByUserId(userId);
  }

  async getArticleById(id: string, userId: string) {
    return this.articleModel.findById(id, userId);
  }

  async getArticleByUrl(url: string, userId: string) {
    const normalizedUrl = normalizeArticleUrl(url);

    return this.articleModel.findByUrl(normalizedUrl, userId);
  }

  async updateArticle(id: string, userId: string, input: UpdateArticleInput) {
    return this.articleModel.update(id, userId, input);
  }
}
