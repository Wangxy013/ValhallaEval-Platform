# Repository Guidelines

## Project Structure & Module Organization

This repository is split into `backend/` and `frontend/`. The Rust backend lives in `backend/src/`, with route handlers under `routes/`, data models under `models/`, database setup in `db/`, and LLM client code in `llm/`. SQL migrations are stored in `backend/migrations/`. The React frontend lives in `frontend/src/`, with API wrappers in `api/`, reusable UI in `components/`, page-level screens in `pages/`, and shared types in `types/`. Deployment assets sit at the root (`docker-compose*.yml`, `Dockerfile.*`, `docker/nginx.conf`), while longer-form docs live in `docs/`.

## Build, Test, and Development Commands

Use `./start.sh` to boot PostgreSQL, the backend on `:8080`, and the Vite frontend on `:3000`. Use `./stop.sh` to stop the local stack. For manual startup: `docker compose up -d`, `cd backend && cargo run`, and `cd frontend && npm run dev`. Build the frontend with `cd frontend && npm run build`. Check backend quality with `cd backend && cargo fmt --check && cargo clippy -- -D warnings`. Validate the frontend type graph with `cd frontend && npx tsc --noEmit`.

## Coding Style & Naming Conventions

Follow `.editorconfig`: 4 spaces for `*.rs`, 2 spaces for `*.ts`, `*.tsx`, JSON, YAML, and shell files. Keep Rust modules and files in `snake_case`; use `PascalCase` for Rust structs and TypeScript React components; use `camelCase` for functions, hooks, and local variables. Existing frontend pages commonly use `pages/<Feature>/index.tsx`, and API modules are grouped by resource, for example `frontend/src/api/tasks.ts`.

## Testing Guidelines

There is no dedicated frontend test runner configured yet, and the current codebase has little to no first-party automated test coverage. For now, every change should pass `cargo clippy`, `cargo fmt --check`, and `npx tsc --noEmit`, plus a manual check of the affected UI or API flow. When adding backend logic, prefer Rust unit tests near the changed module or integration tests under `backend/tests/` if you introduce that directory.

## Commit & Pull Request Guidelines

Follow Conventional Commits, as used in recent history: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`. Keep messages short and imperative. PRs should target `main`, explain the change and motivation, include test steps, link issues with `Closes #N`, and attach screenshots for UI changes. If you change APIs, update `docs/api-reference.md`; if you change user workflows, update `docs/user-guide/`.
