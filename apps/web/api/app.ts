import express, { type Express } from "express";

import { AppError, HttpStatus } from "./errors/appError.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.routes.js";
import { articleRouter } from "./routes/article.routes.js";
import { userRouter } from "./routes/user.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    const origin = process.env["WEB_ORIGIN"] ?? "http://localhost:5173";
    if (req.header("Origin") === origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    next();
  });
  app.use("/auth", authRouter);
  app.use("/articles", articleRouter);
  app.use("/users", userRouter);
  app.use((_req, _res, next) => {
    next(new AppError(HttpStatus.NOT_FOUND, "Route not found"));
  });
  app.use(errorMiddleware);

  return app;
}
