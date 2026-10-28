# Runbook

Everyday commands. **Verified** = actually executed and passed in this repo.
Everything else is proposed until run.

> 2026-10-28: the NestJS backend (`apps/backend-nest`, package `backend`) was
> deleted; `apps/backend-elysia` is the backend. All previously verified
> commands were tied to backend-nest and are superseded — re-verify and record
> outcomes here as you run them.

## Setup

```powershell
bun install          # restore workspace installs
```

Environment is loaded per-workspace from `.env` (backend-elysia uses
`dotenv` + `dotenv-expand`). Variable **names** (never commit values):
`APP_*`, `POSTGRES_*`, `REDIS_*`, `S3_*`; frontend `VITE_API_URL`. Inspect
`apps/backend-elysia/src` for the authoritative list when touching config.

## Build / run

| Command | Where | Status |
|---|---|---|
| `bun run dev` | repo root | proposed — turbo `start:dev` |
| `bun dev` | `apps/backend-elysia` | proposed — `bun run --watch src/index.ts` |
| `bun run build` | repo root / `apps/web-admin` | proposed (not yet re-verified) |

## Checks

| Command | Where | Status |
|---|---|---|
| `bun run lint` | repo root | proposed — re-verify per workspace |
| `bun run typecheck` | repo root | proposed |
| `bun run test` | repo root | proposed — backend-elysia has no test script yet |

## Database (apps/backend-elysia)

```powershell
# proposed until run against your disposable DB; behaviors unverified
bunx drizzle-kit generate   # from schema diff (config: apps/backend-elysia/drizzle.config.ts)
bunx drizzle-kit migrate    # apply migrations
bunx drizzle-kit push       # disposable DBs only
bunx drizzle-kit studio     # inspect
bun run drizzle:seed        # existing seed runner (database/seeders)
bun run auth:generate       # regenerates auth schema — pin `auth@latest` first
```

Rules:
- Never run `drizzle-kit push` or migrations against a database you cannot
  recreate. Push is for disposable DBs only.
- Verify the migration journal state before the first `generate` run; if
  inconsistent, create the disposable DB, apply the full set from scratch, and
  record the outcome before proceeding.
- `auth:generate` script pins nothing (`auth@latest`) — pin before running.
- Seeds must be idempotent (safe to run twice).

## Docker

No backend Dockerfile exists yet for `apps/backend-elysia`. Compose currently
provides `postgres` + `redis` + `web-admin` only; the `backend` service was
removed with backend-nest (2026-10-28).

```powershell
docker compose up postgres redis    # infra for local backend dev
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
