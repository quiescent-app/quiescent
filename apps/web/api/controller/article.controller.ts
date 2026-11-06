import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";

import { articleService } from "../service/article.service.js";

export class ArticleController {
  readonly create: RequestHandler = async (req, res) => {
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
  };

  readonly list: RequestHandler = async (_req, res) => {
    const articles = await articleService.getArticles(res.locals.userId);
    res.status(HttpStatus.OK).json(articles);
  };

  readonly getById: RequestHandler = async (req, res) => {
    const article = await articleService.getArticleById(
      req.params["id"] as string,
      res.locals.userId,
    );
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  };

  readonly getByUrl: RequestHandler = async (req, res) => {
    const url = req.query["url"] as string;

    const article = await articleService.getArticleByUrl(url, res.locals.userId);
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  };

  readonly updateProgress: RequestHandler = async (req, res) => {
    const { readingProgress } = req.body as { readingProgress: number };

    const article = await articleService.updateArticle(
      req.params["id"] as string,
      res.locals.userId,
      { readingProgress },
    );
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  };

  readonly remove: RequestHandler = async (req, res) => {
    const deleted = await articleService.deleteArticle(
      req.params["id"] as string,
      res.locals.userId,
    );
    if (!deleted) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.NO_CONTENT).end();
  };
}
export const articleController = new ArticleController();
