import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { articleModel, ArticleModel } from "../../model/article.model.js";
import { refreshTokenModel, RefreshTokenModel } from "../../model/refreshToken.model.js";
import { userModel, UserModel } from "../../model/user.model.js";
import { createTestDatabase } from "../database/database.js";
import { hashRefreshToken } from "../../utils/token.utils.js";

const databaseState = vi.hoisted(() => ({
  current: undefined as Record<PropertyKey, unknown> | undefined,
}));

vi.mock("../../db/client.js", () => ({
  database: new Proxy(
    {},
    {
      get(_target, property) {
        const current = databaseState.current;
        if (!current) throw new Error("Test database has not been initialized");
        const value = Reflect.get(current, property, current) as unknown;
        return typeof value === "function" ? value.bind(current) : value;
      },
    },
  ),
}));

describe("API integration", () => {
  let client: PGlite;
  let app: ReturnType<typeof createApp>;
  let users: UserModel;
  let refreshTokens: RefreshTokenModel;
  let articles: ArticleModel;

  beforeEach(async () => {
    const testDatabase = await createTestDatabase();
    client = testDatabase.client;
    databaseState.current = testDatabase.database as unknown as Record<PropertyKey, unknown>;
    const database = testDatabase.database as never;

    users = new UserModel(database);
    refreshTokens = new RefreshTokenModel();
    articles = new ArticleModel(database);

    vi.spyOn(userModel, "create").mockImplementation((input) => users.create(input));
    vi.spyOn(userModel, "findByEmail").mockImplementation((email) => users.findByEmail(email));
    vi.spyOn(userModel, "findById").mockImplementation((id) => users.findById(id));
    vi.spyOn(refreshTokenModel, "create").mockImplementation((input) => refreshTokens.create(input));
    vi.spyOn(refreshTokenModel, "findByHash").mockImplementation((hash) => refreshTokens.findByHash(hash));
    vi.spyOn(refreshTokenModel, "rotate").mockImplementation((...args) => refreshTokens.rotate(...args));
    vi.spyOn(refreshTokenModel, "revokeFamily").mockImplementation((familyId) => refreshTokens.revokeFamily(familyId));
    vi.spyOn(articleModel, "create").mockImplementation((input) => articles.create(input));
    vi.spyOn(articleModel, "findByUserId").mockImplementation((userId) => articles.findByUserId(userId));
    vi.spyOn(articleModel, "findById").mockImplementation((id) => articles.findById(id));
    vi.spyOn(articleModel, "findByUrl").mockImplementation((url, userId) => articles.findByUrl(url, userId));
    vi.spyOn(articleModel, "update").mockImplementation((id, userId, input) => articles.update(id, userId, input));
    vi.spyOn(articleModel, "delete").mockImplementation((id, userId) => articles.delete(id, userId));

    app = createApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
