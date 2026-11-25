import { and, eq, inArray, sql } from "drizzle-orm";
import { database } from "../db/client.js";
import { readerResources, type ReaderResource } from "../schema/readerResource.schema.js";

export type ReaderOwner = Readonly<{ userId: string }>;
export type CreateReaderResourceInput = Pick<
  ReaderResource, "sourceType" | "title" | "url" | "sourceDomain"
>;

/** Saves and retrieves a user's saved articles and PDF resources. */
export class ReaderResourceModel {
  /** Saves a resource for this user. The input must already be checked and prepared. */
  async create(owner: ReaderOwner, input: CreateReaderResourceInput): Promise<ReaderResource> {
    const [resource] = await database.insert(readerResources).values({
      userId: owner.userId, sourceType: input.sourceType, title: input.title,
      url: input.url, sourceDomain: input.sourceDomain,
    }).returning();
    if (!resource) throw new Error("Reader resource insert did not return a record");
    return resource;
  }

  /** Finds this user's resource. Returns null if it does not exist. */
  async findById(owner: ReaderOwner, id: string) {
    const [resource] = await database.select().from(readerResources).where(and(
      eq(readerResources.id, id), eq(readerResources.userId, owner.userId),
    )).limit(1);
    return resource ?? null;
  }

  /** Lists this user's resources with the requested status, showing recently opened items first. */
  async list(owner: ReaderOwner, status: ReaderResource["status"]) {
    return database.select().from(readerResources)
      .where(and(eq(readerResources.userId, owner.userId), eq(readerResources.status, status)))
      .orderBy(sql`${readerResources.lastAccessedAt} DESC NULLS LAST`, sql`${readerResources.createdAt} DESC NULLS LAST`);
  }

  /** Deletes this user's resource and its reading sessions. Returns false if nothing was deleted. */
  async delete(owner: ReaderOwner, id: string): Promise<boolean> {
    const deleted = await database.delete(readerResources)
      .where(and(eq(readerResources.id, id), eq(readerResources.userId, owner.userId)))
      .returning({ id: readerResources.id });
    return deleted.length > 0;
  }

  /**
   * Changes the resource's status only if its current status is in allowedPredecessors.
   * Returns the updated resource, or null if nothing matches.
   */
  async setStatus(
    owner: ReaderOwner, id: string, status: ReaderResource["status"],
    allowedPredecessors: readonly ReaderResource["status"][],
  ): Promise<ReaderResource | null> {
    const [resource] = await database.update(readerResources)
      .set({ status, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(readerResources.id, id), eq(readerResources.userId, owner.userId), inArray(readerResources.status, [...allowedPredecessors])))
      .returning();
    return resource ?? null;
  }
}

export const readerResourceModel = new ReaderResourceModel();
