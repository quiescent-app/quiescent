import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { authService } from "../service/auth.service.js";
import {
  getClearRefreshCookieOptions,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from "../utils/cookie.utils.js";

type Credentials = { email: string; password: string };

export class AuthController {
  readonly signUp: RequestHandler = async (req, res) => {
    const { email, password } = req.body as Credentials;
    const result = await authService.register({ email, password });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    res.status(HttpStatus.CREATED).json({ user: result.user, accessToken: result.accessToken });
  };

  readonly login: RequestHandler = async (req, res) => {
    const { email, password } = req.body as Credentials;
    const result = await authService.login({ email, password });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
    res.status(HttpStatus.OK).json({ user: result.user, accessToken: result.accessToken });
  };

  readonly refresh: RequestHandler = async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    try {
      const result = await authService.refresh(refreshToken);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
      res.status(HttpStatus.OK).json({ user: result.user, accessToken: result.accessToken });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === HttpStatus.UNAUTHORIZED) {
        res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
      }
      throw error;
    }
  };

  readonly logout: RequestHandler = async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
    await authService.logout(refreshToken);
    res.status(HttpStatus.NO_CONTENT).end();
  };
}

export const authController = new AuthController();
