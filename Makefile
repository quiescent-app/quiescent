.PHONY: install build build-api build-extension build-web test test-api test-extension test-web db-generate db-migrate lint format

install:
	pnpm install

build: build-api build-extension build-web

build-api:
	pnpm --filter ./apps/web/api build

build-extension:
	pnpm --filter ./apps/extension build

build-web:
	pnpm --filter ./apps/web/ui build

test: test-api test-extension test-web

test-api:
	pnpm --filter ./apps/web/api test

test-extension:
	pnpm --filter ./apps/extension build
	pnpm --filter ./apps/extension test

test-web:
	pnpm --filter ./apps/web/ui build
	pnpm --filter ./apps/web/ui test

db-generate:
	@test -n "$(NAME)" || (echo "Usage: make db-generate NAME=create-users" && exit 1)
	pnpm --filter ./apps/web/api db:generate "$(NAME)"

db-migrate:
	pnpm --filter ./apps/web/api db:migrate

lint:
	pnpm -r --if-present lint

format:
	pnpm -r --if-present lint:fix
