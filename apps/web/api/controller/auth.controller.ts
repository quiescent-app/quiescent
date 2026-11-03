import type { RequestHandler } from "express";

import { HttpStatus } from "../errors/appError.js";
import { AuthService } from "../service/auth.service.js";

export function createAuthController(authService: AuthService) {
  const signUp: RequestHandler = async (req, res) => {
    const result = await authService.register(req.body);
    res.status(HttpStatus.CREATED).json(result);
  };

  const login: RequestHandler = async (req, res) => {
    const result = await authService.login(req.body);
    res.status(HttpStatus.OK).json(result);
  };

  const refresh: RequestHandler = async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(HttpStatus.OK).json(result);
  };

  const logout: RequestHandler = async (req, res) => {
    await authService.logout(req.body?.refreshToken);
    res.status(HttpStatus.NO_CONTENT).end();
  };

  return { signUp, login, refresh, logout };
}
