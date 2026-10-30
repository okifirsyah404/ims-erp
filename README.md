# IMS ERP

An inventory management / ERP system built as a **Bun + Turborepo** monorepo. It consists of a typed API backend (Elysia + PostgreSQL + Redis) and an admin web client (React + Vite), with shared packages for common code and UI components.

Domain modules currently include **users & auth**, **organizations**, **locations** (provinces/regencies/districts/villages), and **sales** (quotations, payments).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime / package manager | [Bun](https://bun.sh) |
| Monorepo orchestration | [Turborepo](https://turborepo.dev) |
| Backend API | [Elysia](https://elysiajs.com) with OpenAPI, CORS, pino logging |
| Database | [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit |
| Cache & queues | [Redis](https://redis.io) + [BullMQ](https://bullmq.io) |
| Auth | [Better Auth](https://www.better-auth.com) (+ api-key, passkey, Drizzle adapter plugins) |
| DI / validation | [tsyringe](https://github.com/microsoft/tsyringe), [Zod](https://zod.dev) |
| Admin frontend | [React 19](https://react.dev) + [Vite](https://vite.dev), [TanStack Router/Query/Form](https://tanstack.com), [Tailwind CSS 4](https://tailwindcss.com) |
| UI library | `@ims-erp/ui` (shadcn-style components) |
| Lint / format / hooks | oxlint, Prettier, husky |
| CI/CD & deployment | GitHub Actions, Docker, Docker Compose |

## Project Structure

```
.
├── apps/
│   ├── backend/             # Elysia API (@ims-erp/backend)
│   │   ├── src/
│   │   │   ├── app/         # Domain modules (user, organization, location, sales)
│   │   │   │   └── <module>/
│   │   │   │       ├── contracts/     # Repository interfaces & DTO contracts
│   │   │   │       ├── controllers/   # Elysia route plugins
│   │   │   │       ├── services/      # Business logic
│   │   │   │       ├── repositories/  # Drizzle data access
│   │   │   │       └── container.ts   # tsyringe DI registration
│   │   │   ├── providers/   # Infra providers (better-auth, logger, queue, ...)
│   │   │   ├── authorization/
│   │   │   ├── contracts/
│   │   │   ├── di/
│   │   │   └── config/
│   │   ├── database/        # Seeders & migration helpers
│   │   ├── drizzle/         # Generated migrations
│   │   └── scripts/
│   └── web-admin/           # Admin SPA (@ims-erp/web-admin) — Vite + React + TanStack Router
├── packages/
│   ├── common/              # Shared code (@ims-erp/common)
│   ├── ui/                  # Shared UI components (@ims-erp/ui)
│   └── eslint-config/
├── docs/
│   └── database/            # DBML schema, data dictionary, module ownership, phases
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

Copy the example env file and fill in the required secrets:

```sh
cp .env.example .env
```

At minimum, set:

| Variable | Purpose |
| --- | --- |
| `APP_SECRET` | App secret; also used as `BETTER_AUTH_SECRET` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials |
| `CORS_ORIGINS` | Browser origins allowed with credentials (defaults to `http://localhost:5173`) |
| `S3_*` | Object storage for avatars/file uploads (optional locally) |
| `SMTP_*` | Email sending (optional locally) |

Other variables (app name/port, Redis, initial admin bootstrap, timezone) have sensible defaults — see `.env.example`.

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

### 5. Run the apps

From the repo root:

```sh
bun dev                                  # backend + web-admin
bun dev --filter=@ims-erp/backend        # backend only
bun dev --filter=@ims-erp/web-admin      # admin frontend only
```

- Backend API: http://localhost:3000 (serves OpenAPI docs via `@elysia/openapi`)
- Admin frontend: http://localhost:5173

## Common Commands

Run from the repo root (Turborepo fans tasks out to all apps/packages):

| Command | Description |
| --- | --- |
| `bun build` | Build all apps & packages |
| `bun dev` | Start all apps in dev mode |
| `bun test` | Run tests (`bun test` in each workspace) |
| `bun lint` | Lint (oxlint) |
| `bun typecheck` | TypeScript check (`tsc --noEmit`) |
| `bun format` | Format (Prettier) |

Use [`--filter`](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters) to target a single workspace, e.g. `bun build --filter=@ims-erp/backend`.

## Deployment

### CI/CD

On merges to `main`, path-filtered GitHub Actions workflows:

- Run tests and builds for the backend and web-admin.
- Build Docker images and push them to Docker Hub:
  - `okifirsyah404/ims-erp-backend`
  - `okifirsyah404/ims-erp-web-admin`

Each image is tagged with both the short commit SHA (`sha-<sha>`) and a moving `dev` tag.

### Running in production / on a server

`docker-compose.yml` pulls the published images and starts the full stack: **backend**, **web-admin**, **postgres**, **redis**. Configure the required variables in `.env` (`APP_NAME`, `APP_ID`, `APP_SECRET`, `POSTGRES_PASSWORD`, optional `S3_*` / `SMTP_*`), then:

```sh
docker compose up -d
```

Useful knobs:

| Variable | Default | Description |
| --- | --- | --- |
| `IMAGE_TAG` | `dev` | Which image tag to pull (`dev` or a `sha-...` tag) |
| `APP_PORT` | `3001` | Host port mapped to the backend (container port 3000) |
| `WEB_ADMIN_PORT` | `8080` | Host port mapped to the web admin (container port 80) |
| `TZ` | `Asia/Jakarta` | Timezone for services |

To build and run the application images from source instead of pulling from Docker Hub (e.g. for a local end-to-end check):

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

## Useful Links

- [Turborepo Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Turborepo Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Elysia Documentation](https://elysiajs.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [TanStack Router](https://tanstack.com/router)
