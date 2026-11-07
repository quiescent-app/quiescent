import type { Request, Response } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";

import { articleService } from "../service/article.service.js";

export class ArticleController {
  async create(req: Request, res: Response): Promise<void> {
    const { title, url, content } = req.body as {
      title: string;
      url: string;
      content?: string;
    };

    const article = await articleService.createArticle(res.locals.userId, {
      title,
      url,
      content,
    });
    res.status(HttpStatus.CREATED).json(article);
  }

  async list(_req: Request, res: Response): Promise<void> {
    const articles = await articleService.getArticles(res.locals.userId);
    res.status(HttpStatus.OK).json(articles);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const article = await articleService.getArticleById(
      req.params["id"] as string,
      res.locals.userId,
    );
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  }

  async getByUrl(req: Request, res: Response): Promise<void> {
    const url = req.query["url"] as string;

    const article = await articleService.getArticleByUrl(url, res.locals.userId);
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  }

  async updateProgress(req: Request, res: Response): Promise<void> {
    const { readingProgress } = req.body as { readingProgress: number };

    const article = await articleService.updateArticle(
      req.params["id"] as string,
      res.locals.userId,
      { readingProgress },
    );
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  }

  async remove(req: Request, res: Response): Promise<void> {
    const deleted = await articleService.deleteArticle(
      req.params["id"] as string,
      res.locals.userId,
    );
    if (!deleted) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.NO_CONTENT).end();
  }
}
export const articleController = new ArticleController();
