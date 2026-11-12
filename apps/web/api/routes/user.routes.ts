import { Router, type RequestHandler } from "express";

import { userController } from "../controller/user.controller.js";
import { AppError, HttpStatus } from "../errors/appError.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const requireDisplayName: RequestHandler = (req, _res, next) => {
  const body = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Request body must be a JSON object");
  }

  const displayName = (body as Record<string, unknown>)["displayName"];
  if (typeof displayName !== "string") {
    throw new AppError(HttpStatus.BAD_REQUEST, "Display name must be a string");
  }

  req.body = { displayName };
  next();
};

export function createUserRouter(): Router {
  const router = Router();
  router.use(requireAuth());
  router.get("/me", userController.getProfile);
  router.patch("/me", requireDisplayName, userController.updateProfile);
  return router;
}

export const userRouter = createUserRouter();
