.DEFAULT_GOAL := run

.PHONY: run install setup build start test help

run:
	npm run dev

install:
	npm ci

setup: install
	@if [ -e .env ]; then \
		printf '%s\n' '.env already exists; keeping it unchanged.'; \
	else \
		cp -n .env.example .env; \
		printf '%s\n' 'Created .env from .env.example; edit it to configure TikTok.'; \
	fi

build:
	npm run build

start:
	npm start

test:
	npm test

help:
	@printf '%s\n' \
		'make / make run  Start the development server' \
		'make setup       Install dependencies and create .env if absent' \
		'make install     Install dependencies with npm ci' \
		'make build       Build the production application' \
		'make start       Start the built production application' \
		'make test        Run unit and integration tests' \
		'make help        Show this help'
