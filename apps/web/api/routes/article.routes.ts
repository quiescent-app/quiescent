import { Router } from "express";

import { createArticleController } from "../controller/article.controller.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { ArticleService } from "../service/article.service.js";

export function createArticleRouter(
  articleService: ArticleService,
  jwtSecret?: Uint8Array,
): Router {
  const router = Router();
  const controller = createArticleController(articleService);

  router.use(createAuthMiddleware(jwtSecret));
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/by-url", controller.getByUrl);
  router.get("/:id", controller.getById);
  router.patch("/:id", controller.updateProgress);
  router.delete("/:id", controller.remove);

  return router;
}
