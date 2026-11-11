import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { getWebOrigin } from "../utils/web-origin.js";

const ALLOWED_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Authorization,Content-Type";

/**
 * Sets CORS headers for the configured web origin and handles preflight requests.
 *
 * @returns Middleware that allows credentialed cross-origin requests from the web origin.
 */
export function corsMiddleware(): RequestHandler {
  const webOrigin = getWebOrigin();

  return (req, res, next) => {
    const origin = req.get("origin");
    res.vary("Origin");

    if (origin === webOrigin) {
      res.setHeader("Access-Control-Allow-Origin", webOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    }

    if (req.method === "OPTIONS") {
      if (origin !== webOrigin) {
        res.status(HttpStatus.FORBIDDEN).end();
        return;
      }
      res.status(HttpStatus.NO_CONTENT).end();
      return;
    }

    next();
  };
}

export function requireWebOrigin(): RequestHandler {
  const webOrigin = getWebOrigin();

  return (req, _res, next) => {
    if (req.get("origin") !== webOrigin) {
      next(new AppError(HttpStatus.FORBIDDEN, "Request origin is not allowed"));
      return;
    }
    next();
  };
}
