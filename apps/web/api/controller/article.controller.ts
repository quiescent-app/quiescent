import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { ArticleService } from "../service/article.service.js";
import {
  requireArticleId,
  requireObjectBody,
} from "../utils/validation.utils.js";

export function createArticleController(articleService: ArticleService) {
  const create: RequestHandler = async (req, res) => {
    const body = requireObjectBody(req.body);
    const { title, url, content } = body;

    if (typeof title !== "string" || !title.trim()) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Article title is required");
    }
    if (typeof url !== "string" || !url.trim()) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Article URL is required");
    }
    if (content !== undefined && typeof content !== "string") {
      throw new AppError(HttpStatus.BAD_REQUEST, "Article content must be a string");
    }

    const article = await articleService.createArticle(res.locals.userId, {
      title,
      url,
      content,
    });
    res.status(HttpStatus.CREATED).json(article);
  };

  const list: RequestHandler = async (_req, res) => {
    const articles = await articleService.getArticles(res.locals.userId);
    res.status(HttpStatus.OK).json(articles);
  };

  const getById: RequestHandler = async (req, res) => {
    const article = await articleService.getArticleById(
      requireArticleId(req.params["id"]),
      res.locals.userId,
    );
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  };

  const getByUrl: RequestHandler = async (req, res) => {
    const url = req.query["url"];
    if (typeof url !== "string" || !url.trim()) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Article URL query parameter is required");
    }

    const article = await articleService.getArticleByUrl(url, res.locals.userId);
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  };

  const updateProgress: RequestHandler = async (req, res) => {
    const body = requireObjectBody(req.body);
    if (typeof body.readingProgress !== "number") {
      throw new AppError(HttpStatus.BAD_REQUEST, "Reading progress must be a number");
    }

    const article = await articleService.updateArticle(
      requireArticleId(req.params["id"]),
      res.locals.userId,
      { readingProgress: body.readingProgress },
    );
    if (!article) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.OK).json(article);
  };

  const remove: RequestHandler = async (req, res) => {
    const deleted = await articleService.deleteArticle(
      requireArticleId(req.params["id"]),
      res.locals.userId,
    );
    if (!deleted) throw new AppError(HttpStatus.NOT_FOUND, "Article not found");
    res.status(HttpStatus.NO_CONTENT).end();
  };

  return { create, list, getById, getByUrl, updateProgress, remove };
}
