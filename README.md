# Quiescent

## Local setup

Install the workspace dependencies:

```bash
make install
```

The API uses Drizzle ORM with a Neon PostgreSQL database. Create the local
environment file from the committed example:

```bash
cp apps/web/api/.env.example apps/web/api/.env
```

Then replace the
example `DATABASE_URL` in `apps/web/api/.env` with the Neon connection string.
Set `JWT_SECRET` to a random secret containing at least 32 bytes.
Apply the committed migrations:

```bash
make db-migrate
```

Start the API with `pnpm --filter @quiescent/api start` (optional `PORT`,
default `3000`).

Environment files and database credentials are ignored by Git. Never expose
`DATABASE_URL` to the web or extension clients.

## Development commands

Run the repository checks with:

```bash
make lint
make test
make build
```

Additional commands:

```bash
make format
```

After making changes to the database schema, generate a migration with a
short, descriptive name, then apply it to the configured database:

```bash
make db-generate NAME=change-name
make db-migrate
```

API database tests apply the committed migrations to a fresh, embedded PGlite
database, so `make test` does not require Neon credentials. The live Neon
health query runs only when `DATABASE_URL` is configured.

## Authentication API

The API exposes `POST /auth/sign-up` and `POST /auth/login`. Both accept JSON
with `email` and `password` and return a safe user record, access token, and
refresh token. Sign-up responds with `201`; login responds with `200`.

```bash
curl -X POST http://localhost:3000/auth/sign-up \
  -H 'content-type: application/json' \
  -d '{"email":"reader@example.com","password":"a-long-password"}'

curl -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"reader@example.com","password":"a-long-password"}'
```

Refresh tokens can be renewed with `POST /auth/refresh`, using
`{"refreshToken":"..."}`. The response contains a replacement refresh token;
clients must store it and stop using the old token. `POST /auth/logout` accepts
the same body and responds with `204` after revoking that token family.

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"saved-refresh-token"}'

curl -X POST http://localhost:3000/auth/logout \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"saved-refresh-token"}'
```

Errors use `{ "error": { "message": "..." } }`. Invalid input returns `400`,
invalid credentials or refresh tokens return `401`, duplicate email returns
`409`, an oversized body returns `413`, unsupported request encoding returns
`415`, unknown routes return `404`, and unexpected server errors return a
generic `500` response.
