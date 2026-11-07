import { Router, type RequestHandler } from "express";

import { authController } from "../controller/auth.controller.js";
import { AppError, HttpStatus } from "../errors/appError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ensures a request payload is a JSON object before checking its fields. */
function requireObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

/** Validates credentials, trims the email, and passes only accepted fields downstream. */
const requireCredentials: RequestHandler = (req, _res, next) => {
  const values = requireObjectBody(req.body);
  const email = values["email"];
  const password = values["password"];

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A valid email is required");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A password is required");
  }

  req.body = { email: email.trim(), password };
  next();
};

/** Requires a non-empty refresh token and passes a normalized body to the controller. */
const requireRefreshToken: RequestHandler = (req, _res, next) => {
  const values = requireObjectBody(req.body);
  const refreshToken = values["refreshToken"];
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A refresh token is required");
  }

  req.body = { refreshToken };
  next();
};

/** Allows logout without a token and validates it when provided. */
const requireLogoutRefreshToken: RequestHandler = (req, _res, next) => {
  const values = requireObjectBody(req.body ?? {});
  const refreshToken = values["refreshToken"];
  if (refreshToken !== undefined && typeof refreshToken !== "string") {
    throw new AppError(HttpStatus.BAD_REQUEST, "Refresh token must be a string");
  }

  req.body = { refreshToken };
  next();
};
const router = Router();

router.post("/sign-up", requireCredentials, authController.signUp);
router.post("/login", requireCredentials, authController.login);
router.post("/refresh", requireRefreshToken, authController.refresh);
router.post("/logout", requireLogoutRefreshToken, authController.logout);

export default router;
