import { Router } from "express";

import { articleController } from "../controller/article.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export function createArticleRouter(
  jwtSecret?: Uint8Array,
): Router {
  const router = Router();

  router.use(requireAuth(jwtSecret));
  router.get("/", articleController.list);
  router.post("/", articleController.create);
  router.get("/by-url", articleController.getByUrl);
  router.get("/:id", articleController.getById);
  router.patch("/:id", articleController.updateProgress);
  router.delete("/:id", articleController.remove);

  return router;
}

export const articleRouter = createArticleRouter();
