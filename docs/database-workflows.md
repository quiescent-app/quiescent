# Database workflows

Quiescent uses **two separate database workflows**:

- **Local database development:** Developers generate and apply Drizzle migrations when changing an existing database.
- **Automated API testing (including CI):** Tests generate a fresh SQL schema from the TypeScript schema definitions and load it into isolated PGlite databases.

The `apps/web/api/drizzle/` migration directory is **intentionally ignored by Git**. It is for local migration history, not an input to the CI test flow.

## 1. Local development: Drizzle migrations

Use this workflow when you need to change the schema of an **existing development database**.

1. Update the relevant TypeScript schema definition in `apps/web/api/schema/`.

2. From the **repository root**, generate a migration with a descriptive name:

   ```bash
   make db-generate NAME=add-example-column
   ```

3. **Review the generated SQL** in `apps/web/api/drizzle/` before applying it. Check for destructive operations or unexpected changes.

4. Confirm that `DATABASE_URL` points to the intended development database, then run:

   ```bash
   make db-migrate
   ```

5. Verify that the database schema and application behavior are correct.

### Local migration history

- `apps/web/api/drizzle/` contains generated migration SQL files and Drizzle metadata. These files remain on your local machine but are **not committed to Git**.
- You shouldn't delete your local `drizzle/` folder if you're still using its migration history to update an existing Neon database.
- **Always inform, discuss, or tell the team when making any database schema changes**, since migration files are not shared through Git.

## 2. API tests and CI: fresh PGlite databases

The automated test workflow does **not** read from `apps/web/api/drizzle/`.

From the repository root, run:

```bash
make test-api
```

This invokes the API package test script, which runs:

```bash
pnpm run test:schema && vitest run test
```

The flow is:

```text
TypeScript schema definitions
          |
          v
   drizzle-kit export
          |
          v
 test/database/schema.sql  (generated, ignored)
          |
          v
   createTestDatabase()
          |
          v
  New in-memory PGlite instance
          |
          v
 Execute generated SQL
          |
          v
 Run model integration tests
```

### How it works

1. `script/generate-test-schema.ts` executes `pnpm exec drizzle-kit export` and writes the result to `test/database/schema.sql`.
2. `test/database/database.ts` creates a new PGlite instance and executes that generated SQL.
3. Model integration tests use these isolated PGlite databases to exercise queries and constraints.
4. The test setup runs against the **current TypeScript schema definitions**, without depending on locally generated migration files or writing to Neon.

The generated `apps/web/api/test/database/schema.sql` file is ignored by Git because it is recreated before each test run.

### Neon connectivity check

`test/database/database.test.ts` also includes a separate read-only Neon health check (`SELECT 1`). It runs **only when `DATABASE_URL` is set** and is skipped otherwise. It verifies basic connectivity, not schema compatibility. Unlike the PGlite integration tests, this check contacts the configured Neon database.

## 3. CI/CD and production database changes

- **CI**: runs the automated test flow; it does not need checked-in `drizzle/` files.
- **CD**: The deployment workflow has not been implemented or discussed yet and will be addressed in the future.

> Note: `drizzle-kit export` produces SQL to initialize a **fresh** database. It will not apply incremental schema changes on an existing database.
