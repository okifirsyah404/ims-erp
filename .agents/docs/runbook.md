# Runbook

Everyday commands. **Verified** = actually executed and passed in this repo
(recorded 2026-10-25). Everything else is proposed until run.

## Setup

```powershell
bun install          # restore workspace installs
```

Environment is loaded from `.env` by `src/config/config.loader.ts` and
validated by zod (`config.schema.ts`). Variable **names** (never commit
values): `NODE_ENV`, `TZ`, `APP_NAME`, `APP_ID`, `APP_SECRET`, `APP_HOST`,
`APP_PORT`, `APP_URL`, `APP_LOG_LEVEL`, `POSTGRES_HOST`, `POSTGRES_PORT`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_URL`,
`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_QUEUE_DB`,
`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT`,
`S3_USE_PATH_STYLE`; frontend `VITE_API_URL`.

## Build / run

| Command | Where | Status |
|---|---|---|
| `bun run build` | repo root | proposed (not yet run) |
| `docker build -f apps/backend/Dockerfile .` | repo root | verified — image builds; container bootstraps Nest (modules init) with env-only config; full compose run against real Postgres/Redis not yet done |
| `bun run dev` / `bun run start:dev` | repo root (`start:dev` for backend) | proposed |
| `bun run start:prod` | `apps/backend` (serves `dist/main` with Node) | proposed — not for production use yet |

## Checks

| Command | Where | Status |
|---|---|---|
| `bun run lint` | repo root | verified (backend) |
| `bunx vitest run` | `apps/backend` | verified — baseline has 7 failing spec files; see `project-audit.md` |
| `bun run test` | repo root | verified failing until backend green |
| `bun run build` | `apps/web-admin` | proposed (TypeScript `tsc -b` + vite) |

## Backend container (apps/backend/Dockerfile)

Multi-stage bun image (oven/bun:1.4-alpine), build context = repo root:

```powershell
docker build -f apps/backend/Dockerfile .          # build image
docker compose -f docker-compose.yml -f docker-compose.override.yml up backend
```

Design notes (2026-10-27):
- `nest build` output keeps working because `@providers/*` path-alias imports
  were removed from source (3 files); `dist/` is now self-contained.
- `config.loader.ts` no longer throws when no `.env` file exists (ENOENT is
  ignored) — compose passes env vars directly.
- Runtime stage installs production deps for the whole workspace (bun lacks
  per-workspace production install); acceptable size cost for now.
- Verified: `docker build` succeeds; `bun dist/main.js` in the container
  passes dotenv (no `.env` needed), zod env validation, and initializes all
  Nest modules (BootstrapModule → AppModule). Not yet verified: serving
  requests against real Postgres/Redis via compose.
- Compose env is still missing `SMTP_*` (required by the config schema) and
  the loader does not read `REDIS_QUEUE_DB` — follow-ups.

## Database (apps/backend)

```powershell
# proposed until run against your disposable DB; behaviors unverified as of 2026-10-25
bunx drizzle-kit generate --config ./drizzle.config.ts   # from schema diff
bunx drizzle-kit migrate   --config ./drizzle.config.ts   # apply migrations
bun run db:seed                                          # existing seed runner
```

Rules:
- Never run `drizzle-kit push` or migrations against a database you cannot
  recreate. Push is for disposable DBs only.
- Baseline migration `20261025064638_create_auth_schema` is immutable.
- Verify whether `database/migrations/meta` journal entries exist before the
  first `generate` run; if missing, create the disposable DB, apply the full
  set from scratch, and record the outcome before proceeding.
- `auth:generate` script pins nothing (`auth@latest`) — pin before running.
- Seeds must be idempotent (safe to run twice).

## Troubleshooting notes

| Symptom | First check |
|---|---|
| DX/typecheck errors about `@backend/*` paths | `apps/backend/tsconfig.json` paths + `vite-tsconfig-paths` in vitest config |
| Auth route 404 / body not found | Fastify `bodyParser: false` in `main.ts`; integration needs raw bodies |
| Redis connect failures | `REDIS_*` names; BullMQ uses `REDIS_QUEUE_DB` when set |
| Cache entries "stale" for 30 s–5 min diffs | TTL is ms in CacheModule, s in Better Auth secondaryStorage |
| Strange migration warnings | rc-channel drizzle; see `stack-compatibility.md` unresolved issues |

## Backup/restore

Not established. Postgres dump/restore commands must be agreed before phase 7;
record the verified approach here once proven. Do not improvise against DBs
you can't recreate.

## Hygiene

- After schema changes: generated migration inspected by a human.
- After touches: run lint + tests in the affected workspace and update
  `progress.md` with the exact commands and outcomes.
