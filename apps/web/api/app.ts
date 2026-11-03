import express, { type Express } from "express";

import { AppError, HttpStatus } from "./errors/appError.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { AuthService } from "./service/auth.service.js";

export function createApp(authService: AuthService): Express {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  app.use("/auth", createAuthRouter(authService));
  app.use((_req, _res, next) => {
    next(new AppError(HttpStatus.NOT_FOUND, "Route not found"));
  });
  app.use(errorMiddleware);

  return app;
}
