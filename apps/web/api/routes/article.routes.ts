import { Router, type RequestHandler } from "express";

import { articleController } from "../controller/article.controller.js";
import { AppError, HttpStatus } from "../errors/appError.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireArticleId, requireObjectBody } from "../utils/article.validation.js";

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
  requireArticleId(req.params["id"]);
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

export function createArticleRouter(
  jwtSecret?: Uint8Array,
): Router {
  const router = Router();

  router.use(requireAuth(jwtSecret));
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
