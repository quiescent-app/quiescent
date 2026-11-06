import type { RequestHandler } from "express";

import { HttpStatus } from "../errors/appError.js";
import { authService } from "../service/auth.service.js";

type Credentials = { email: string; password: string };

export class AuthController {
  readonly signUp: RequestHandler = async (req, res) => {
    const { email, password } = req.body as Credentials;
    const result = await authService.register({ email, password });
    res.status(HttpStatus.CREATED).json(result);
  };

  readonly login: RequestHandler = async (req, res) => {
    const { email, password } = req.body as Credentials;
    const result = await authService.login({ email, password });
    res.status(HttpStatus.OK).json(result);
  };

  readonly refresh: RequestHandler = async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await authService.refresh(refreshToken);
    res.status(HttpStatus.OK).json(result);
  };

  readonly logout: RequestHandler = async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    await authService.logout(refreshToken);
    res.status(HttpStatus.NO_CONTENT).end();
  };
}

export const authController = new AuthController();
