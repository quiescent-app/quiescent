.PHONY: install build build-api build-extension build-web test test-api test-extension test-web db-generate db-migrate lint format

install:
	pnpm install

build: build-api build-extension build-web

build-api:
	pnpm --filter ./apps/api build

build-extension:
	pnpm --filter ./apps/extension build

build-web:
	pnpm --filter ./apps/web build

test: test-api test-extension test-web

test-api:
	pnpm --filter ./apps/api test

test-extension:
	pnpm --filter ./apps/extension build
	pnpm --filter ./apps/extension test

test-web:
	pnpm --filter ./apps/web build
	pnpm --filter ./apps/web test

db-generate:
	@test -n "$(NAME)" || (echo "Usage: make db-generate NAME=create-users" && exit 1)
	pnpm --filter ./apps/api db:generate "$(NAME)"

db-migrate:
	pnpm --filter ./apps/api db:migrate

lint:
	pnpm -r --if-present lint

format:
	pnpm -r --if-present lint:fix
