import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../db/client.js";
import { refreshTokens } from "../schema/refreshTokens.schema.js";

export type RefreshTokenRecord = typeof refreshTokens.$inferSelect;

export interface RotatedRefreshToken extends Record<string, unknown> {
  userId: string;
  familyId: string;
}

export class RefreshTokenModel {
  constructor(private readonly database: Database) {}

  async create(input: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.insert(refreshTokens).values(input);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [token] = await this.database
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    return token ?? null;
  }

  async rotate(
    tokenHash: string,
    replacementHash: string,
    expiresAt: Date,
  ): Promise<RotatedRefreshToken | null> {
    const result = await this.database.execute<RotatedRefreshToken>(sql`
      WITH consumed AS (
        UPDATE refresh_tokens
        SET revoked_at = now()
        WHERE token_hash = ${tokenHash}
          AND revoked_at IS NULL
          AND expires_at > now()
        RETURNING user_id, family_id
      ), inserted AS (
        INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
        SELECT user_id, family_id, ${replacementHash}, ${expiresAt}
        FROM consumed
        RETURNING user_id AS "userId", family_id AS "familyId"
      )
      SELECT "userId", "familyId" FROM inserted
    `);

    return result.rows[0] ?? null;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.database
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.familyId, familyId), sql`${refreshTokens.revokedAt} IS NULL`),
      );
  }
}
