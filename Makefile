.DEFAULT_GOAL := help

# Self-documenting target pattern adapted from:
# https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help
help: ## Show this help message
	@awk 'BEGIN {FS = ":[[:space:]]*##[[:space:]]+"} /^[a-zA-Z_-]+:.*## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install the locked dependency tree
	npm ci

.PHONY: dev
dev: ## Start the Vite development server
	npm run dev

.PHONY: build
build: ## Type-check and create a production build
	npm run build

.PHONY: preview
preview: ## Preview the production build locally
	npm run preview

.PHONY: format
format: ## Format the repository with Prettier
	npm run format

.PHONY: format-check
format-check: ## Check formatting without changing files
	npm run format:check

.PHONY: lint
lint: ## Check source files with Oxlint
	npm run lint

.PHONY: test
test: ## Run the test suite once
	npm test

.PHONY: test-watch
test-watch: ## Run the test suite in watch mode
	npm run test:watch

.PHONY: check
check: ## Run all required completion checks
	npm run format:check
	npm run lint
	npm test
	npm run build
