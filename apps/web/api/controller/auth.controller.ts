import type { RequestHandler } from "express";

import { AppError, HttpStatus } from "../errors/appError.js";
import { authService } from "../service/auth.service.js";
import {
  getClearRefreshCookieOptions,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from "../utils/cookie.utils.js";

type Credentials = { email: string; password: string };

function setRefreshCookie(res: Parameters<RequestHandler>[1], refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
}

function clearRefreshCookie(res: Parameters<RequestHandler>[1]): void {
  res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
}

function sendSession(
  res: Parameters<RequestHandler>[1],
  status: HttpStatus,
  result: Awaited<ReturnType<typeof authService.register>>,
): void {
  setRefreshCookie(res, result.refreshToken);
  res.status(status).json({ user: result.user, accessToken: result.accessToken });
}

export class AuthController {
  readonly signUp: RequestHandler = async (req, res) => {
    const { email, password } = req.body as Credentials;
    const result = await authService.register({ email, password });
    sendSession(res, HttpStatus.CREATED, result);
  };

  readonly login: RequestHandler = async (req, res) => {
    const { email, password } = req.body as Credentials;
    const result = await authService.login({ email, password });
    sendSession(res, HttpStatus.OK, result);
  };

  readonly refresh: RequestHandler = async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    try {
      const result = await authService.refresh(refreshToken);
      sendSession(res, HttpStatus.OK, result);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === HttpStatus.UNAUTHORIZED) {
        clearRefreshCookie(res);
      }
      throw error;
    }
  };

  readonly logout: RequestHandler = async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    clearRefreshCookie(res);
    await authService.logout(refreshToken);
    res.status(HttpStatus.NO_CONTENT).end();
  };
}

export const authController = new AuthController();
