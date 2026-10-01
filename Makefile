.PHONY: install build test lint format

install:
	pnpm install

build:
	pnpm -r --if-present build

lint:
	pnpm --filter ./apps/extension lint

format:
	pnpm --filter ./apps/extension lint:fix
