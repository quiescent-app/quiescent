import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import type { Database } from "../../db/client.js";
import { ArticleModel } from "../../model/article.model.js";
import { RefreshTokenModel } from "../../model/refreshToken.model.js";
import { UserModel } from "../../model/user.model.js";
import { ArticleService } from "../../service/article.service.js";
import { AuthService } from "../../service/auth.service.js";
import { createTestDatabase } from "../database/database.js";
import { hashRefreshToken } from "../../utils/token.utils.js";

const jwtSecret = new TextEncoder().encode("integration-test-secret-that-is-32-bytes");

describe("API integration", () => {
  let client: PGlite;
  let app: ReturnType<typeof createApp>;
  let users: UserModel;
  let refreshTokens: RefreshTokenModel;

  beforeEach(async () => {
    const testDatabase = await createTestDatabase();
    client = testDatabase.client;
    const database = testDatabase.database as unknown as Database;

    users = new UserModel(database);
    refreshTokens = new RefreshTokenModel(database);
    app = createApp(
      new AuthService(users, refreshTokens, undefined, jwtSecret),
      new ArticleService(new ArticleModel(database)),
      jwtSecret,
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("should register and authenticate a user through the API and persist a hashed password", async () => {
    const credentials = {
      email: "reader@example.com",
      password: "correct-horse-battery",
    };
    const signUp = await request(app)
      .post("/auth/sign-up")
      .send(credentials)
      .expect(201);

    expect(signUp.body.user.email).toBe(credentials.email);
    expect(signUp.body.user).not.toHaveProperty("password");

    const storedUser = await users.findByEmail(credentials.email);
    expect(storedUser).not.toBeNull();
    expect(storedUser?.password).not.toBe(credentials.password);
    expect(storedUser?.password).toMatch(/^\$argon2id\$/);

    const storedRefreshToken = await refreshTokens.findByHash(
      hashRefreshToken(signUp.body.refreshToken),
    );
    expect(storedRefreshToken).not.toBeNull();

    const login = await request(app)
      .post("/auth/login")
      .send(credentials)
      .expect(200);
    expect(login.body.user.id).toBe(signUp.body.user.id);
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));

    await request(app)
      .post("/auth/login")
      .send({ ...credentials, password: "incorrect-password" })
      .expect(401)
      .expect({ error: { message: "Invalid email or password" } });
  });

  it("should rotate the refresh token when a refresh request succeeds", async () => {
    const signUp = await request(app)
      .post("/auth/sign-up")
      .send({ email: "reader@example.com", password: "correct-horse-battery" })
      .expect(201);
    const originalToken = signUp.body.refreshToken as string;

    const refreshed = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: originalToken })
      .expect(200);
    const replacementToken = refreshed.body.refreshToken as string;

    expect(replacementToken).not.toBe(originalToken);
    const originalRecord = await refreshTokens.findByHash(hashRefreshToken(originalToken));
    const replacementRecord = await refreshTokens.findByHash(
      hashRefreshToken(replacementToken),
    );
    expect(originalRecord?.revokedAt).toBeInstanceOf(Date);
    expect(replacementRecord?.revokedAt).toBeNull();
    expect(replacementRecord?.familyId).toBe(originalRecord?.familyId);
  });

  it("should revoke the token family when the user logs out", async () => {
    const signUp = await request(app)
      .post("/auth/sign-up")
      .send({ email: "reader@example.com", password: "correct-horse-battery" })
      .expect(201);
    const originalToken = signUp.body.refreshToken as string;
    const refreshed = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: originalToken })
      .expect(200);
    const replacementToken = refreshed.body.refreshToken as string;

    await request(app)
      .post("/auth/logout")
      .send({ refreshToken: replacementToken })
      .expect(204);

    const revokedReplacement = await refreshTokens.findByHash(
      hashRefreshToken(replacementToken),
    );
    expect(revokedReplacement?.revokedAt).toBeInstanceOf(Date);
    await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: replacementToken })
      .expect(401);
  });

  it("should create, update, list, and delete an article through the authenticated API", async () => {
    const signUp = await request(app)
      .post("/auth/sign-up")
      .send({ email: "reader@example.com", password: "correct-horse-battery" })
      .expect(201);
    const authorization = `Bearer ${signUp.body.accessToken as string}`;

    const created = await request(app)
      .post("/articles")
      .set("Authorization", authorization)
      .send({
        title: "Example article",
        url: "https://example.com/article?utm_source=newsletter",
        content: "An article worth reading",
      })
      .expect(201);

    expect(created.body.url).toBe("https://example.com/article?utm_source=newsletter");
    expect(created.body.domain).toBe("example.com");
    expect(created.body.readingProgress).toBe(0);

    const listed = await request(app)
      .get("/articles")
      .set("Authorization", authorization)
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);

    const updated = await request(app)
      .patch(`/articles/${created.body.id as string}`)
      .set("Authorization", authorization)
      .send({ readingProgress: 100 })
      .expect(200);
    expect(updated.body.readingProgress).toBe(100);
    expect(updated.body.completedAt).toEqual(expect.any(String));

    await request(app)
      .delete(`/articles/${created.body.id as string}`)
      .set("Authorization", authorization)
      .expect(204);
    await request(app)
      .get("/articles")
      .set("Authorization", authorization)
      .expect(200)
      .expect([]);
  });
});
