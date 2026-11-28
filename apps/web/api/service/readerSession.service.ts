import { AppError, HttpStatus } from "../errors/appError.js";
import { readerResourceModel } from "../model/readerResource.model.js";
import { readerSessionModel, type ReaderProgressInput } from "../model/readerSession.model.js";

const MAX_POSITION = 2_147_483_647;

export class ReaderSessionService {
  async open(userId: string, resourceId: string) {
    const resource = await this.findResource(userId, resourceId);
    if (resource.sourceType !== "url" || !resource.url) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Only resources with a usable URL can be opened");
    }
    const session = await readerSessionModel.open({ userId }, resourceId,
      resource.status === "not_started" ? { from: "not_started", to: "reading" } : null);
    if (!session) throw new AppError(HttpStatus.CONFLICT, "Reader resource could not be opened");
    return session;
  }

  async findById(userId: string, id: string) {
    const session = await readerSessionModel.findById({ userId }, id);
    if (!session) throw new AppError(HttpStatus.NOT_FOUND, "Reader session not found");
    return session;
  }

  async findLatestSession(userId: string, resourceId: string) {
    await this.findResource(userId, resourceId);
    return readerSessionModel.findLatestSession({ userId }, resourceId);
  }

  async recent(userId: string) {
    return readerSessionModel.recent({ userId });
  }

  async updateProgress(userId: string, id: string, input: ReaderProgressInput) {
    const session = await this.findById(userId, id);
    if (session.endedAt !== null) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Ended sessions cannot be changed");
    }
    if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Progress must be an integer between 0 and 100");
    }
    if (input.scrollOffset !== null && (!Number.isInteger(input.scrollOffset) || input.scrollOffset < 0 || input.scrollOffset > MAX_POSITION)) {
      throw new AppError(HttpStatus.BAD_REQUEST, `Scroll offset must be null or an integer between 0 and ${MAX_POSITION}`);
    }
    if (input.pageNumber !== null && (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > MAX_POSITION)) {
      throw new AppError(HttpStatus.BAD_REQUEST, `Page number must be null or an integer between 1 and ${MAX_POSITION}`);
    }
    if (input.scrollOffset !== null && input.pageNumber !== null) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Scroll offset and page number cannot both be set");
    }
    const resource = await this.findResource(userId, session.resourceId);
    if ((resource.sourceType === "url" && input.pageNumber !== null) ||
      (resource.sourceType === "pdf" && input.scrollOffset !== null)) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Reading position does not match the resource source type");
    }
    if (session.status === "completed" && input.progress !== 100) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Completed sessions must keep progress at 100");
    }
    const updated = await readerSessionModel.updateProgress({ userId }, id, input);
    if (!updated) throw new AppError(HttpStatus.CONFLICT, "Reader session could not be updated");
    return updated;
  }

  async setStatus(userId: string, id: string, status: string, failureCode: string | null = null) {
    const session = await this.findById(userId, id);
    if (session.endedAt !== null) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Ended sessions cannot be changed");
    }
    if (status !== "active" && status !== "completed" && status !== "failed") {
      throw new AppError(HttpStatus.BAD_REQUEST, "Invalid session status");
    }
    if (!((session.status === "active" && (status === "completed" || status === "failed")) ||
      ((session.status === "completed" || session.status === "failed") && status === "active"))) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Invalid session status transition");
    }
    if (status === "completed" && session.progress !== 100) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Progress must be 100 before completing a session");
    }
    if (status === "failed") {
      if (failureCode !== "unavailable" && failureCode !== "expired" && failureCode !== "unsupported") {
        throw new AppError(HttpStatus.BAD_REQUEST, "A valid failure code is required for failed sessions");
      }
    } else if (failureCode !== null) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Failure code must be null for non-failed sessions");
    }
    const updated = await readerSessionModel.setStatus({ userId }, id, status, failureCode);
    if (!updated) throw new AppError(HttpStatus.CONFLICT, "Reader session could not be updated");
    return updated;
  }

  async end(userId: string, id: string) {
    const session = await readerSessionModel.end({ userId }, id);
    if (!session) throw new AppError(HttpStatus.NOT_FOUND, "Reader session not found");
    return session;
  }

  private async findResource(userId: string, resourceId: string) {
    const resource = await readerResourceModel.findById({ userId }, resourceId);
    if (!resource) throw new AppError(HttpStatus.NOT_FOUND, "Reader resource not found");
    return resource;
  }
}

export const readerSessionService = new ReaderSessionService();
