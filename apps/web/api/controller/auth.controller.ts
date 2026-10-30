import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { AuthService } from "../service/auth.service.js";
import {
  requireCredentials,
  requireObjectBody,
  requireRefreshToken,
} from "../utils/validation.utils.js";

export function createAuthController(authService: AuthService) {
  const signUp: RequestHandler = async (req, res) => {
    const result = await authService.register(requireCredentials(req.body));
    res.status(HttpStatus.CREATED).json(result);
  };

  const login: RequestHandler = async (req, res) => {
    const result = await authService.login(requireCredentials(req.body));
    res.status(HttpStatus.OK).json(result);
  };

  const refresh: RequestHandler = async (req, res) => {
    const result = await authService.refresh(requireRefreshToken(req.body));
    res.status(HttpStatus.OK).json(result);
  };

  const logout: RequestHandler = async (req, res) => {
    const body = req.body ?? {};
    const values = requireObjectBody(body);
    const refreshToken = values.refreshToken;
    if (refreshToken !== undefined && typeof refreshToken !== "string") {
      throw new AppError(HttpStatus.BAD_REQUEST, "Refresh token must be a string");
    }
    await authService.logout(refreshToken);
    res.status(HttpStatus.NO_CONTENT).end();
  };

  return { signUp, login, refresh, logout };
}
