.PHONY: install build build-extension build-web test test-extension test-web lint format

install:
	pnpm install

build:
	pnpm -r --if-present build

build-extension:
	pnpm --filter ./apps/extension build

build-web:
	pnpm --filter ./apps/web build

test: test-extension test-web

test-extension:
	pnpm --filter ./apps/extension build
	pnpm --filter ./apps/extension test

test-web:
	pnpm --filter ./apps/web build
	pnpm --filter ./apps/web test

lint:
	pnpm -r --if-present lint

format:
	pnpm -r --if-present lint:fix