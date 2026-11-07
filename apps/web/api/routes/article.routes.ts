import { Router, type RequestHandler } from "express";

import { articleController } from "../controller/article.controller.js";
import { AppError, HttpStatus } from "../errors/appError.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function requireObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

const requireCreateArticle: RequestHandler = (req, _res, next) => {
  const values = requireObjectBody(req.body);
  const { title, url, content } = values;

  if (typeof title !== "string" || !title.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Article title is required");
  }
  if (typeof url !== "string" || !url.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Article URL is required");
  }
  if (content !== undefined && typeof content !== "string") {
    throw new AppError(HttpStatus.BAD_REQUEST, "Article content must be a string");
  }

  req.body = { title, url, content };
  next();
};

const requireArticleUrl: RequestHandler = (req, _res, next) => {
  const url = req.query["url"];
  if (typeof url !== "string" || !url.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Article URL query parameter is required");
  }
  next();
};

const requireValidArticleId: RequestHandler = (req, _res, next) => {
  const id = req.params["id"];
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Article ID must be a valid UUID");
  }
  next();
};

const requireReadingProgress: RequestHandler = (req, _res, next) => {
  const body = requireObjectBody(req.body);
  if (typeof body["readingProgress"] !== "number") {
    throw new AppError(HttpStatus.BAD_REQUEST, "Reading progress must be a number");
  }
  req.body = { readingProgress: body["readingProgress"] };
  next();
};

export function createArticleRouter(): Router {
  const router = Router();

  router.use(requireAuth());
  router.get("/", articleController.list);
  router.post("/", requireCreateArticle, articleController.create);
  router.get("/by-url", requireArticleUrl, articleController.getByUrl);
  router.get("/:id", requireValidArticleId, articleController.getById);
  router.patch(
    "/:id",
    requireValidArticleId,
    requireReadingProgress,
    articleController.updateProgress,
  );
  router.delete("/:id", requireValidArticleId, articleController.remove);

  return router;
}

export const articleRouter = createArticleRouter();
