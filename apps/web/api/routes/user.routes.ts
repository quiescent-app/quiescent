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

const requireImageUpload: RequestHandler = (req, _res, next) => {
  const body: unknown = req.body;
  if (
    typeof body !== "object" || body === null || Array.isArray(body) ||
    !("contentType" in body) || typeof body.contentType !== "string" ||
    !("sizeBytes" in body) || typeof body.sizeBytes !== "number"
  ) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Expected a content type and size in bytes");
  }
  req.body = { contentType: body.contentType, sizeBytes: body.sizeBytes };
  next();
};

const requireImageUploadToken: RequestHandler = (req, _res, next) => {
  const body: unknown = req.body;
  if (
    typeof body !== "object" || body === null || Array.isArray(body) ||
    !("uploadToken" in body) || typeof body.uploadToken !== "string" || !body.uploadToken
  ) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Upload token is required");
  }
  req.body = { uploadToken: body.uploadToken };
  next();
};

export function createUserRouter(): Router {
  const router = Router();
  router.use(requireAuth());
  router.get("/me", userController.getProfile);
  router.patch("/me", requireDisplayName, userController.updateProfile);
  router.get("/me/profile-image", userController.getProfileImage);
  router.post("/me/profile-image/uploads", requireImageUpload, userController.prepareProfileImage);
  router.post(
    "/me/profile-image/uploads/:id/complete",
    requireImageUploadToken,
    userController.completeProfileImage,
  );
  router.delete("/me/profile-image", userController.deleteProfileImage);
  return router;
}

export const userRouter = createUserRouter();
