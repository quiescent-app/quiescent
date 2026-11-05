# Repository Guidelines

## Project Structure & Module Organization

This pnpm workspace contains three TypeScript applications:

- `apps/extension/`: React/Vite Chrome extension; `src/` separates popup, background, content scripts, and shared types. Static extension files live in `public/`.
- `apps/web/ui/`: React/Vite web interface, with application code and styles in `src/`.
- `apps/web/api/`: authentication and database code, organized into `service/`, `model/`, `schema/`, `utils/`, and `db/`.

Frontend tests live in each application's `tests/`; API tests live in `test/`. Contributor and architecture notes are in `docs/`, and CI workflows are in `.github/workflows/`.

## Build, Test, and Development Commands

Run commands from the repository root:

- `make install`: install workspace dependencies with pnpm.
- `make build`: type-check all applications and build the extension and UI.
- `make test`: run all application tests; also build the extension and UI.
- `make lint`: run each application's ESLint checks.
- `make format`: run available `lint:fix` scripts; this does not format every package.
- `pnpm --filter ./apps/web/ui dev`: start the web development server. Use `./apps/extension` for extension development.
- `make db-generate NAME=change-name`: generate a named Drizzle migration.
- `make db-migrate`: apply migrations to the configured database.

Use `make test-api`, `make test-extension`, or `make test-web` for focused checks. The root `pnpm test` is a placeholder that fails.

## Coding Style & Naming Conventions

Use two-space indentation and follow nearby quote and semicolon conventions. Use PascalCase for React components and types, camelCase for functions and variables, and descriptive API suffixes such as `auth.service.ts` and `user.model.ts`. Preserve `.js` extensions in API relative imports. ESLint provides TypeScript and React checks; no dedicated formatter is configured.

## Testing Guidelines

Use Vitest with `*.test.ts` or `*.test.tsx` filenames. Frontend tests use React Testing Library and jsdom. API database tests use embedded PGlite and require no Neon credentials. Add regression tests for behavior changes; no numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

History uses short descriptive commit subjects without a consistent enforced prefix. Keep commits focused. Follow `docs/pr_and_branch_naming.md`: branches use `category/developer/short-description`, and PR titles use `category/developer: short-description`, with matching category and developer. Complete the PR template with summary, change type, area, rationale, and testing steps. Run lint, tests, and build before submission.

## Security & Configuration

Copy `apps/web/api/.env.example` to `.env` and configure database credentials locally. Never commit secrets or expose `DATABASE_URL` to web or extension clients.