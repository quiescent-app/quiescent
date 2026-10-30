import type { ErrorRequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === HttpStatus.BAD_REQUEST &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    res.status(HttpStatus.BAD_REQUEST).json({
      error: { message: "Request body must contain valid JSON" },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      error: { message: "Request body is too large" },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error.type === "encoding.unsupported" || error.type === "charset.unsupported")
  ) {
    res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
      error: { message: "Unsupported request encoding" },
    });
    return;
  }

  console.error("Unhandled error:", error);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    error: { message: "Internal server error" },
  });
};
