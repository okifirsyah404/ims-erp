# IMS ERP

An inventory management / ERP system built as a **Bun + Turborepo** monorepo. It consists of a typed API backend (Elysia + PostgreSQL + Redis), an admin web client (React + Vite), and two Astro sites (public website + customer portal), with shared packages for common code, UI components, locales, design tokens and email templates.

Domain modules: 22 backend modules over **20 Postgres schemas / 196 tables** (ADR-0024, ADR-0026) — identity (`auth`), location, company, customer, supplier, product, warehouse, inventory, sale, procurement, finance, tax, payment, project, ticket, human resource, document, notification, audit, automation, plus the schema-less `webhook` edge. Ownership and contracts: `docs/database/module-ownership.md`.

## Tech Stack

| Layer                     | Technology                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime / package manager | [Bun](https://bun.sh)                                                                                                                                   |
| Monorepo orchestration    | [Turborepo](https://turborepo.dev)                                                                                                                      |
| Backend API               | [Elysia](https://elysiajs.com) with OpenAPI, CORS, pino logging                                                                                         |
| Database                  | [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit                                                        |
| Cache & queues            | [Redis](https://redis.io) + [BullMQ](https://bullmq.io)                                                                                                 |
| Auth                      | [Better Auth](https://www.better-auth.com) (+ api-key, passkey, Drizzle adapter plugins)                                                                |
| DI / validation           | [tsyringe](https://github.com/microsoft/tsyringe), [Zod](https://zod.dev)                                                                               |
| Admin frontend            | [React 19](https://react.dev) + [Vite](https://vite.dev), [TanStack Router/Query/Form](https://tanstack.com), [Tailwind CSS 4](https://tailwindcss.com) |
| Public website & portal   | [Astro](https://astro.build) (SSR via `@astrojs/node`) — `apps/web-landing`, `apps/web-customer-portal`                                              |
| UI library                | `@ims-erp/ui` (shadcn-style components)                                                                                                                 |
| i18n                      | [i18next](https://www.i18next.com/) + [elysia-i18next](https://github.com/eelkevdbos/elysia-i18next) + `@ims-erp/locales` (shared locales)              |
| Lint / format / hooks     | oxlint, Prettier, husky                                                                                                                                 |
| CI/CD & deployment        | GitHub Actions, Docker, Docker Compose                                                                                                                  |

## Project Structure

```
.
├── apps/
│   ├── backend/             # Elysia API (@ims-erp/backend)
│   │   ├── src/
│   │   │   ├── app/         # 22 domain modules (audit … warehouse, webhook)
│   │   │   │   └── <module>/
│   │   │   │       ├── contracts/     # Repository interfaces & DTO contracts
│   │   │   │       ├── controllers/   # Elysia route plugins
│   │   │   │       ├── services/      # Business logic
│   │   │   │       ├── repositories/  # Drizzle data access
│   │   │   │       ├── errors/        # Domain errors (extend AppError)
│   │   │   │       ├── constants/di.ts
│   │   │   │       └── container.ts   # tsyringe DI registration
│   │   │   ├── app/app.ts   # createApp() factory — mounts every controller
│   │   │   ├── authorization/  # guards, role/permission checks
│   │   │   ├── cache/       # Redis cache helpers
│   │   │   ├── di/          # DRIZZLE_TOKEN / REDIS_TOKEN, provider
│   │   │   ├── http/        # response envelopes, AppError, domainPlugin
│   │   │   ├── providers/   # better-auth, logger, queue, mail, storage
│   │   │   ├── shared/      # per-module numbering table factory, etc.
│   │   │   ├── utils/
│   │   │   └── index.ts     # composition root: registers modules, listens
│   │   ├── database/        # migrations/, migrations-archive/v1, seeders/, migrate-reset.ts
│   │   ├── drizzle/         # schemas/ (one per Postgres schema), datatypes/
│   │   ├── scripts/         # smoke tests, one-off scripts
│   │   └── test/            # unit tests (bun:test)
│   ├── web-admin/           # Admin SPA (@ims-erp/web-admin) — Vite + React + TanStack Router (:5173)
│   ├── web-landing/         # Public website (@ims-erp/web-landing) — Astro (:4321)
│   └── web-customer-portal/ # Customer portal (@ims-erp/web-customer-portal) — Astro (:4322)
├── packages/
│   ├── common/              # Shared types & permission catalog (@ims-erp/common)
│   ├── design-tokens/       # Design tokens (@ims-erp/design-tokens)
│   ├── locales/             # en/id translation bundles (@ims-erp/locales)
│   ├── react-email/         # Email templates (@ims-erp/react-email)
│   └── ui/                  # Shared UI components (@ims-erp/ui)
├── docs/
│   ├── architecture/        # boundaries, runbook, ADRs, per-module pages
│   ├── database/            # docs.dbml (canonical), data dictionary, ownership
│   ├── integrations/        # n8n workflows, WhatsApp
│   ├── plan/                # progress, backlog, phases
│   └── user-guide/          # end-user guides (EN/ID)
├── graphify-out/            # Generated codebase knowledge graph (not source of truth)
├── docker-compose.yml       # Deployment compose (pulls published images)
├── docker-compose.local.yml # Local override (builds images from source)
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.4+
- [Docker](https://www.docker.com) (for local Postgres/Redis and containerized runs)

### 1. Install dependencies

```sh
bun install
```

### 2. Configure environment

Environment files are decentralized per workspace — each app owns its own `.env`:

```sh
cp apps/backend/.env.example apps/backend/.env
cp apps/web-admin/.env.example apps/web-admin/.env
cp apps/web-landing/.env.example apps/web-landing/.env
cp apps/web-customer-portal/.env.example apps/web-customer-portal/.env
```

At minimum, set in `apps/backend/.env`:

| Variable                              | Purpose                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `APP_SECRET`                          | App secret; also used as `BETTER_AUTH_SECRET`                                  |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials                                                           |
| `S3_*`                                | Object storage for avatars/file uploads (optional locally)                     |
| `SMTP_*`                              | Email sending (optional locally)                                               |

Browser origins allowed for credentialed CORS live in the gitignored
`apps/backend/cors.json` (not in env) — copy the template and edit:

```sh
cp apps/backend/cors.example.json apps/backend/cors.json
```

It is a JSON object with `allow` and `blacklist` origin arrays (both optional,
blacklist wins over allow):

```json
{
	"allow": ["https://app.example.com", "http://localhost:5173"],
	"blacklist": []
}
```

A missing file falls back to `APP_WEB_URL`/`APP_URL`; a malformed one fails the
boot. Override its location with `CORS_CONFIG_PATH` (docker-compose mounts
`apps/backend/cors.json` read-only into the container).

In `apps/web-admin/.env`, set `VITE_API_URL` to the backend URL (must match the backend's `APP_PORT`).

The two Astro apps read `ERP_API_BASE_URL` (server-to-server, default `http://localhost:3001`). Both default to demo/sample data locally; see each `.env.example`.

Other variables (app name/port, Redis, initial admin bootstrap, timezone) have sensible defaults — see `apps/backend/.env.example`.

### 3. Start infrastructure

Local development uses Docker for Postgres and Redis:

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml up postgres redis
```

### 4. Run database migrations & seed

From `apps/backend`:

```sh
bun run drizzle:generate   # generate migrations from schema
bun run drizzle:migrate    # apply migrations
bun run drizzle:seed       # seed initial data (incl. admin bootstrap)
bun run drizzle:studio     # browse the DB (optional)
```

Migrations are one folder per Postgres schema (`database/migrations/`). To rebuild
a local database from zero — drops every schema, re-applies the 20 migrations,
then seeds — run `bun run drizzle:migrate-reset`. It is destructive by design, so
point it at a local database you can recreate and never at data you need to keep.
Details: `docs/architecture/runbook.md`.

### 5. Run the apps

From the repo root:

```sh
bun dev                                  # backend + web-admin + web-landing + web-customer-portal
bun dev --filter=@ims-erp/backend        # backend only
bun dev --filter=@ims-erp/web-admin      # admin frontend only
```

- Backend API: http://localhost:3001 (serves OpenAPI docs via `@elysia/openapi`)
- Admin frontend: http://localhost:5173
- Public website: http://localhost:4321
- Customer portal: http://localhost:4322

### 6. Build the codebase knowledge graph (optional)

[graphify](https://pypi.org/project/graphifyy/) indexes the repo into a machine-readable graph of symbols, god nodes, community structure, and cross-file relationships, so coding agents (and humans) can query the codebase instead of grepping raw files.

```sh
graphify extract .   # full build → graphify-out/ (AST + semantic, needs an LLM API key)
graphify update .    # refresh after code changes (AST-only, no LLM cost)
```

With `graphify-out/graph.json` in place, `graphify query "<question>"` returns a scoped subgraph for a codebase question. See [Codebase Knowledge Graph](#codebase-knowledge-graph) for the full command set.

## Common Commands

Run from the repo root (Turborepo fans tasks out to all apps/packages):

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `bun build`     | Build all apps & packages                |
| `bun dev`       | Start all apps in dev mode               |
| `bun test`      | Run tests (`bun test` in each workspace) |
| `bun lint`      | Lint (oxlint)                            |
| `bun typecheck` | TypeScript check (`tsc --noEmit`)        |
| `bun format`    | Format (Prettier)                        |

Use [`--filter`](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters) to target a single workspace, e.g. `bun build --filter=@ims-erp/backend`.

## Deployment

### CI/CD

On merges to `main`, path-filtered GitHub Actions workflows:

- Run tests and builds for the backend, web-admin, web-landing and web-customer-portal.
- Build Docker images and push them to GitHub Container Registry (login with the workflow's `GITHUB_TOKEN`, no extra secrets):
  - `ghcr.io/okifirsyah404/ims-erp-backend`
  - `ghcr.io/okifirsyah404/ims-erp-web-admin`
  - `ghcr.io/okifirsyah404/ims-erp-landing`
  - `ghcr.io/okifirsyah404/ims-erp-customer-portal`

Each image is tagged with both the short commit SHA (`sha-<sha>`) and a moving `dev` tag.

### Running in production / on a server

`docker-compose.yml` pulls the published images and starts the full stack: **backend**, **web-admin**, **web-landing**, **web-customer-portal**, **postgres**, **redis** (plus **dicebear** for avatars). Compose substitution needs a deployment `.env` next to `docker-compose.yml` (or pass `--env-file`), separate from the dev workspace env files — configure `APP_NAME`, `APP_ID`, `APP_SECRET`, `POSTGRES_PASSWORD`, optional `S3_*` / `SMTP_*`, then:

```sh
# Only while the GHCR packages are private: a classic PAT with read:packages.
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
docker compose up -d
```

Useful knobs:

| Variable                    | Default        | Description                                            |
| --------------------------- | -------------- | ------------------------------------------------------ |
| `IMAGE_TAG`                 | `dev`          | Which image tag to pull (`dev` or a `sha-...` tag)     |
| `APP_PORT`                  | `3001`         | Host port mapped to the backend (container port 3000)  |
| `WEB_ADMIN_PORT`            | `8080`         | Host port mapped to the web admin (container port 80)  |
| `WEB_LANDING_PORT`          | `4321`         | Host port mapped to the public website                 |
| `WEB_CUSTOMER_PORTAL_PORT`  | `4322`         | Host port mapped to the customer portal                |
| `TZ`                        | `Asia/Jakarta` | Timezone for services                                  |

To build and run the application images from source instead of pulling from GHCR (e.g. for a local end-to-end check):

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

## Codebase Knowledge Graph

[graphify](https://pypi.org/project/graphifyy/) maintains a codebase knowledge graph under `graphify-out/` — god nodes (architectural hubs), community structure, and cross-file relationships extracted from the source. It is a derived artifact: when the graph and the code disagree, the code is right — regenerate (`graphify update .`) and move on.

| Command                        | Description                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| `graphify extract .`           | Full extraction (AST + semantic) → `graphify-out/`                          |
| `graphify update .`            | Re-extract code files and refresh the graph (no LLM needed)                 |
| `graphify query "<question>"`  | BFS traversal, returns a scoped subgraph (far smaller than raw grep output) |
| `graphify path "<A>" "<B>"`    | Shortest path between two nodes                                             |
| `graphify explain "<concept>"` | Plain-language explanation of a node and its neighbors                      |
| `graphify god-nodes`           | Most-connected nodes (architectural hubs)                                   |
| `graphify watch .`             | Rebuild the graph on file changes                                           |

Outputs worth knowing:

- `graphify-out/GRAPH_REPORT.md` — human-readable overview; read it for broad architecture review only, not for answering specific questions.
- `graphify-out/wiki/index.md` — broad navigation entry point when present.
- `graphify-out/graph.json` — the graph itself; `query` / `path` / `explain` consume it.

Notes:

- The directory is regenerated, expected to be dirty after git hooks or incremental updates, and should not be treated as documentation to edit by hand.
- `graphify opencode install` (and equivalent per-agent installs) appends a short graphify usage section to `AGENTS.md`; that section is managed by graphify, not by this repo's docs.

## Useful Links

- [Turborepo Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Turborepo Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Elysia Documentation](https://elysiajs.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [TanStack Router](https://tanstack.com/router)
