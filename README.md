# Quiescent

## Local setup

Install the workspace dependencies:

```bash
make install
```

The API uses Drizzle ORM with a Neon PostgreSQL database. Create the local
environment file from the committed example:

```bash
cp apps/api/.env.example apps/api/.env
```

Then replace the
example `DATABASE_URL` in `apps/api/.env` with the Neon connection string.
Apply the committed migrations:

```bash
make db-migrate
```

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
database, so `make test` does not require Neon credentials.
