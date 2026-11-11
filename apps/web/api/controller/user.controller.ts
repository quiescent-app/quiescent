import type { Request, Response } from "express";

import { HttpStatus } from "../errors/appError.js";
import { userService } from "../service/user.service.js";

export class UserController {
  async getProfile(_req: Request, res: Response): Promise<void> {
    const user = await userService.getProfile(res.locals.userId as string);
    res.status(HttpStatus.OK).json(user);
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    const { displayName } = req.body as { displayName: string };
    const user = await userService.updateProfile(
      res.locals.userId as string,
      displayName,
    );
    res.status(HttpStatus.OK).json(user);
  }
}

export const userController = new UserController();
