# Runbook

Everyday commands. **Verified** = actually executed and passed in this repo.
Everything else is proposed until run.

> 2026-10-28: the NestJS backend (`apps/backend-nest`, package `backend`) was
> deleted; `apps/backend` is the backend. All previously verified
> commands were tied to backend-nest and are superseded — re-verify and record
> outcomes here as you run them.

## Setup

```powershell
bun install          # restore workspace installs
```

Environment is loaded per-workspace from `.env` (the backend uses
`dotenv` + `dotenv-expand`). Variable **names** (never commit values):
`APP_*`, `POSTGRES_*`, `REDIS_*`, `S3_*`, `SMTP_*`; frontend `VITE_API_URL`. Inspect
`apps/backend/src` for the authoritative list when touching config.

## Build / run

| Command | Where | Status |
|---|---|---|
| `bun run dev` | repo root | ✅ verified 2026-10-29 — `turbo run dev`; live HTTP bring-up |
| `bun dev` | `apps/backend` | ✅ verified 2026-10-29/30 — `bun run --watch src/index.ts` |
| `bun run build` | repo root / `apps/web-admin` | ✅ verified 2026-10-29/30 (web-admin tsc + vite) |

## Checks

| Command | Where | Status |
|---|---|---|
| `bun run lint` | repo root | ✅ verified 2026-10-28→30 — pass; remaining warnings pre-existing |
| `bun run typecheck` | repo root | ✅ verified 2026-10-28→30 — backend clean |
| `bun run test` | repo root | ✅ verified 2026-10-30 — backend 78 pass / 0 fail |

## Database (apps/backend)

Use the package scripts — all run drizzle-kit under the Bun runtime
(`bunx --bun drizzle-kit ...`); the `--bun` flag is required because the DB
driver is `drizzle-orm/bun-sql`:

```powershell
bun run drizzle:generate   # from schema diff (config: apps/backend/drizzle.config.ts) — verified 2026-10-29/30
bun run drizzle:migrate    # apply migrations — verified 2026-10-29/30
bun run drizzle:push       # disposable DBs only
bun run drizzle:studio     # inspect
bun run drizzle:seed       # seed runners (database/seeders) — verified idempotent (run twice)
```

`auth:generate` is intentionally not listed: the `@better-auth/cli` 1.4.x
generator regresses `drizzle/schemas/auth.schema.ts` and its script path is
stale — hand-write auth-schema deltas instead (root `AGENTS.md` hard rule).

Rules:
- Never run `drizzle-kit push` or migrations against a database you cannot
  recreate. Push is for disposable DBs only.
- Verify the migration journal state before the first `generate` run; if
  inconsistent, create the disposable DB, apply the full set from scratch, and
  record the outcome before proceeding.
- `auth:generate` script pins nothing (`auth@latest`) — pin before running.
- Seeds must be idempotent (safe to run twice).

## Docker

Compose provides `postgres` + `redis` (local infra) plus `backend` + `web-admin`
services pulling published Docker Hub images (`docker-compose.yml`); build
images from source with `docker-compose.local.yml`. A source-build backend
Dockerfile for local dev iteration is open backlog work.

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up postgres redis    # infra for local backend dev
```

## Troubleshooting notes

| Symptom | First check |
|---|---|
| Redis connect failures | `REDIS_*` env names |
| Cache entries "stale" for 30 s–5 min diffs | TTL is ms in Keyv, s in Better Auth secondaryStorage |
| Strange migration warnings | rc-channel drizzle; see `stack-compatibility.md` unresolved issues |
| Auth route body not parsed | Elysia body parsing config; better-auth needs raw bodies for webhooks/sign-up |

## Backup/restore

Not established. Postgres dump/restore commands must be agreed before phase 7;
record the verified approach here once proven. Do not improvise against DBs
you can't recreate.

## Hygiene

- After schema changes: generated migration inspected by a human.
- After touches: run lint + tests in the affected workspace and update
  `progress.md` with the exact commands and outcomes.
