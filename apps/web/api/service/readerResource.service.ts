import { NeonDbError } from "@neondatabase/serverless";
import { DrizzleQueryError } from "drizzle-orm/errors";

import { AppError, HttpStatus } from "../errors/appError.js";
import { readerResourceModel } from "../model/readerResource.model.js";
import type { ReaderResource } from "../schema/readerResource.schema.js";

export interface CreateReaderResourceRequest {
  url: string;
  title: string;
}

export class ReaderResourceService {
  async create(userId: string, input: CreateReaderResourceRequest) {
    let url: URL;
    try {
      if (typeof input.url !== "string") throw new Error("Invalid URL");
      url = new URL(input.url);
      if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
        throw new Error("Invalid URL");
      }
      url.hash = "";
    } catch {
      throw new AppError(HttpStatus.BAD_REQUEST, "Resource URL must be a valid HTTP or HTTPS URL without credentials");
    }

    if (typeof input.title !== "string" || !input.title.trim()) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Resource title must not be empty");
    }

    try {
      return await readerResourceModel.create({ userId }, {
        sourceType: "url",
        url: url.toString(),
        sourceDomain: url.hostname,
        title: input.title.trim(),
      });
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;
      if (cause instanceof NeonDbError && cause.code === "23505" && cause.constraint === "reader_user_url_unique") {
        throw new AppError(HttpStatus.CONFLICT, "Reader resource already exists");
      }
      throw error;
    }
  }

  async findById(userId: string, id: string) {
    const resource = await readerResourceModel.findById({ userId }, id);
    if (!resource) throw new AppError(HttpStatus.NOT_FOUND, "Reader resource not found");
    return resource;
  }

  async list(userId: string, status: string) {
    return readerResourceModel.list({ userId }, this.validateStatus(status));
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const deleted = await readerResourceModel.delete({ userId }, id);
    if (!deleted) throw new AppError(HttpStatus.NOT_FOUND, "Reader resource not found");
    return deleted;
  }

  async setStatus(userId: string, id: string, status: string) {
    const nextStatus = this.validateStatus(status);
    const resource = await this.findById(userId, id);
    if (!((resource.status === "reading" && nextStatus === "finished") ||
      (resource.status === "finished" && nextStatus === "reading"))) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Resource status can only change between reading and finished");
    }
    const updated = await readerResourceModel.setStatus({ userId }, id, nextStatus);
    if (!updated) throw new AppError(HttpStatus.NOT_FOUND, "Reader resource not found");
    return updated;
  }

  private validateStatus(status: string): ReaderResource["status"] {
    if (status !== "not_started" && status !== "reading" && status !== "finished") {
      throw new AppError(HttpStatus.BAD_REQUEST, "Invalid resource status");
    }
    return status;
  }
}

export const readerResourceService = new ReaderResourceService();
