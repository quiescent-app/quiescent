import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { verifyAccessToken } from "../utils/token.utils.js";

/**
 * Requires a valid Bearer access token and stores its user ID in `res.locals.userId`.
 *
 * @returns Middleware that forwards a 401 error when the token is missing or invalid.
 */
export function requireAuth(): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.header("authorization");
    const [scheme, token, ...extra] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token || extra.length > 0) {
      next(new AppError(HttpStatus.UNAUTHORIZED, "Authentication required"));
      return;
    }

    try {
      const { userId } = await verifyAccessToken(token);
      res.locals.userId = userId;
      next();
    } catch {
      next(new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired access token"));
    }
  };
}
