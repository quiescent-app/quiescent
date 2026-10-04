.PHONY: install build build-extension test lint format

install:
	pnpm install

build:
	pnpm -r --if-present build

build-extension:
	pnpm --filter ./apps/extension build

test:
	pnpm --filter ./apps/extension build
	pnpm --filter ./apps/extension test

lint:
	pnpm -r --if-present lint

format:
	pnpm -r --if-present lint:fix