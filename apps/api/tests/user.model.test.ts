import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { UserModel } from "../src/model/user.model.js";
import { createTestDatabase } from "./helpers/database.js";

describe("UserModel", () => {
  let client: PGlite;
  let database: PgliteDatabase<typeof schema>;
  let model: UserModel;

  beforeEach(async () => {
    ({ client, database } = await createTestDatabase());
    model = new UserModel(database as unknown as Database);
  });

  afterEach(async () => {
    await client.close();
  });

  it("creates and returns a user with database-generated fields", async () => {
    const beforeCreate = new Date();

    const user = await model.create({
      email: "reader@example.com",
      password: "$hash$already-created-by-service",
    });

    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(user.email).toBe("reader@example.com");
    expect(user.password).toBe("$hash$already-created-by-service");
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
  });

  it("finds users by email and id", async () => {
    const created = await model.create({
      email: "reader@example.com",
      password: "stored-hash",
    });

    await expect(model.findByEmail(created.email)).resolves.toEqual(created);
    await expect(model.findById(created.id)).resolves.toEqual(created);
  });

  it("returns null when a user does not exist", async () => {
    await expect(model.findByEmail("missing@example.com")).resolves.toBeNull();
    await expect(
      model.findById("00000000-0000-4000-8000-000000000000"),
    ).resolves.toBeNull();
  });

  it("propagates the database unique-constraint error", async () => {
    await model.create({
      email: "reader@example.com",
      password: "first-hash",
    });

    await expect(
      model.create({
        email: "reader@example.com",
        password: "second-hash",
      }),
    ).rejects.toMatchObject({
      cause: { code: "23505", constraint: "users_email_unique" },
    });
  });

  it.each(["email", "password"])(
    "enforces the non-null constraint for %s",
    async (column) => {
      const email = column === "email" ? null : "reader@example.com";
      const password = column === "password" ? null : "stored-hash";

      await expect(
        database.execute(
          sql`insert into users (email, password) values (${email}, ${password})`,
        ),
      ).rejects.toMatchObject({ cause: { code: "23502" } });
    },
  );
});
