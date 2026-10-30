import { Router } from "express";

import { createAuthController } from "../controller/auth.controller.js";
import { AuthService } from "../service/auth.service.js";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);

  router.post("/sign-up", controller.signUp);
  router.post("/login", controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);

  return router;
}
