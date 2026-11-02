import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { verifyAccessToken } from "../utils/token.utils.js";

export function createAuthMiddleware(secret?: Uint8Array): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.header("authorization");
    const [scheme, token, ...extra] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token || extra.length > 0) {
      next(new AppError(HttpStatus.UNAUTHORIZED, "Authentication required"));
      return;
    }

    try {
      const { userId } = await verifyAccessToken(token, secret);
      res.locals.userId = userId;
      next();
    } catch {
      next(new AppError(HttpStatus.UNAUTHORIZED, "Invalid or expired access token"));
    }
  };
}
