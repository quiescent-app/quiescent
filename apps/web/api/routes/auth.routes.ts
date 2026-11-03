import { Router, type RequestHandler } from "express";

import { createAuthController } from "../controller/auth.controller.js";
import { AppError, HttpStatus } from "../errors/appError.js";
import { AuthService } from "../service/auth.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

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

const requireRefreshToken: RequestHandler = (req, _res, next) => {
  const values = requireObjectBody(req.body);
  const refreshToken = values["refreshToken"];
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A refresh token is required");
  }

  req.body = { refreshToken };
  next();
};

const requireLogoutRefreshToken: RequestHandler = (req, _res, next) => {
  const values = requireObjectBody(req.body ?? {});
  const refreshToken = values["refreshToken"];
  if (refreshToken !== undefined && typeof refreshToken !== "string") {
    throw new AppError(HttpStatus.BAD_REQUEST, "Refresh token must be a string");
  }

  req.body = { refreshToken };
  next();
};

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);

  router.post("/sign-up", requireCredentials, controller.signUp);
  router.post("/login", requireCredentials, controller.login);
  router.post("/refresh", requireRefreshToken, controller.refresh);
  router.post("/logout", requireLogoutRefreshToken, controller.logout);

  return router;
}
