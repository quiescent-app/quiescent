import type { Request, Response } from "express";

import { HttpStatus } from "../errors/appError.js";
import { uploadService } from "../service/upload.service.js";
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

  async getProfileImage(_req: Request, res: Response): Promise<void> {
    const image = await uploadService.getProfileImage(res.locals.userId as string);
    res.set("Cache-Control", "no-store").status(HttpStatus.OK).json({ image });
  }

  async prepareProfileImageUpload(req: Request, res: Response): Promise<void> {
    const input = req.body as { contentType: string; sizeBytes: number };
    const { pending, target } = await uploadService.prepareUpload(res.locals.userId as string, input);
    res.set("Cache-Control", "no-store").status(HttpStatus.CREATED).json({ id: pending.id, target });
  }

  async completeProfileImageUpload(req: Request<{ id: string }>, res: Response): Promise<void> {
    const result = await uploadService.completeUpload(
      res.locals.userId as string,
      req.params.id,
    );
    res.status(HttpStatus.OK).json(result);
  }

  async deleteProfileImage(_req: Request, res: Response): Promise<void> {
    await uploadService.deleteProfileImage(res.locals.userId as string);
    res.status(HttpStatus.NO_CONTENT).end();
  }
}

export const userController = new UserController();
