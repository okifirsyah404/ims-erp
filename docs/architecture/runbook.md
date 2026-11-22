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
| `bun run dev:website` / `bun run dev:portal` | repo root | proposed — the public website (`@ims-erp/web-landing`, :4321) and the customer portal (`@ims-erp/web-customer-portal`, :4322) in `apps/`, moved in 2026-11-15; their `astro check` (0 errors) and `astro build` were verified the same day, dev servers not started here |
| `bun run typecheck` | repo root | ✅ verified 2026-11-15 — 6/6 turbo tasks, including `astro check` of `@ims-erp/web-landing` (167 files) and `@ims-erp/web-customer-portal` (147 files), 0 errors each |

## Checks

| Command | Where | Status |
|---|---|---|
| `bun run lint` | repo root | ✅ verified 2026-10-28→30 — pass; remaining warnings pre-existing |
| `bun run typecheck` | repo root | ✅ verified 2026-10-28→30 — backend clean |
| `bun run test` | repo root | ✅ verified 2026-11-20 — 7/7 turbo tasks (backend 1232, web-landing 24, web-customer-portal 60 pass); earlier 2026-11-02: backend 131, web-admin 21 |
| `bunx tsc -p tsconfig.app.json --noEmit` | `apps/web-admin` | ✅ verified 2026-11-20 — 0 errors. The root `typecheck` does not cover web-admin (no `typecheck` script); this is the real check (also part of `build`) |

### Live smoke tests (need a running backend on :3001)

These hit real HTTP against seeded data; they are **not** part of `bun run
test` and must be run deliberately. Run them from `apps/backend` (config is
loaded per-workspace from `.env`).

| Command | Proves | Status |
|---|---|---|
| `bun run scripts/smoke-admin-api.ts` | 18 checks over `/admin/users`, `/admin/roles`, `/admin/roles/permissions`, `/admin/audit`, `/admin/invitations`, the escalation guard, and every member denial (403) | ✅ verified 2026-11-02 — 18 passed / 0 failed |
| `bun run scripts/smoke-cache-invalidation.ts` | the shared `auth.users` cache: an admin deactivate/restore/soft-delete is visible on the self-service read path **immediately** (no 5-minute staleness) | ✅ verified 2026-11-02 — 9 passed / 0 failed, idempotent |
| `bun run scripts/smoke-avatar-worker.ts` | the avatar BullMQ worker was **started through the worker registry** and is subscribed to the queue: dispatches a job and waits for the worker to consume it (state leaves `waiting`) | ✅ verified 2026-11-02 — consumed, idempotent |
| `bun run scripts/smoke-login-gate.ts` | the web-admin login gate on the real Better Auth instance (ADR-0017 §8, ADR-0018): app admin without membership signs in, portal role alone is refused with 403, portal role plus an internal membership signs in. Creates and removes its own users | ✅ verified 2026-11-14 — 8/8 cases on a disposable database. Needs `POSTGRES_URL` pointed at a throwaway database, never the dev one |

Both scripts sign in as the seeded admin (`admin@local.com`) and/or member
(`member.seed@entragate.local`) and reference the seeded organization id.
`smoke-cache-invalidation.ts` restores its fixture, so it is safe to re-run;
`smoke-admin-api.ts` creates and deletes its own throwaway role.

`smoke-avatar-worker.ts` asserts **consumption only**, not a rendered avatar.
Avatar rendering calls DiceBear, which the Compose stack exposes only as an
internal service (`http://dicebear:3000`, no published port), so a bare local
`bun run dev` cannot complete a render — the job is consumed and then fails on
`ECONNREFUSED` to DiceBear. That failure proves the worker is wired; it is not
a regression. To assert the rendered image outside Compose, point
`AVATAR_API_URL` at `https://api.dicebear.com`.


> The backend dev log prints full session cookies. Do not paste it into
> issues, chats or commits.

## Realtime socket (`/ws`) and reverse proxies

The API exposes one WebSocket endpoint, `GET /ws` (ADR-0016), authenticated by
the Better Auth session cookie presented with the upgrade request. A proxy in
front of `apps/backend` must forward the upgrade or the browser sees a 401/hang
instead of a socket:

| Proxy | Requirement |
|---|---|
| nginx | `location /ws { proxy_pass http://backend:3001; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_read_timeout 3600s; }`. The default `proxy_read_timeout 60s` silently drops an idle socket. |
| Caddy | nothing to add — `reverse_proxy` forwards `Upgrade` by default. |
| Traefik | nothing to add for a standard HTTP router; do not enable a per-route `passHostHeader: false` unless the cookie domain allows it, or the session cookie will not be sent on upgrade. |
| Cloudflare / any CDN | must not buffer the endpoint; keep `/ws` out of the cache rules. |

Verified locally (2026-11-13): a raw upgrade without a session returns
`401 {"message":"Authentication required"}`; with a session the socket opens
and `hub.publish` reaches the client. Unit coverage lives in
`apps/backend/test/unit/realtime.hub.test.ts` and `realtime.gateway.test.ts`.

The hub is **in-process** (`Map<userId, sockets>`). Running more than one API
instance requires Redis pub/sub fanout first — until then each instance only
knows its own connections.

## Database (apps/backend)

Use the package scripts — all run drizzle-kit under the Bun runtime
(`bunx --bun drizzle-kit ...`); the `--bun` flag is required because the DB
driver is `drizzle-orm/bun-sql`:

```powershell
bun run drizzle:generate   # from schema diff (config: apps/backend/drizzle.config.ts) — verified 2026-11-19 (baseline below: "No schema changes")
bun run drizzle:migrate    # apply migrations — verified 2026-11-19 on a disposable database (baseline below)
bun run drizzle:push       # disposable DBs only
bun run drizzle:studio     # inspect
bun run drizzle:seed       # seed runners (database/seeders) — verified idempotent (run twice)
```

`auth:generate` is intentionally not listed: the `@better-auth/cli` 1.4.x
generator regresses `drizzle/schemas/auth.schema.ts` and its script path is
stale — hand-write auth-schema deltas instead (root `AGENTS.md` hard rule).

**Migration baseline (ADR-0024 + ADR-0019, per-schema since 2026-11-21).**
History, kept honest:

- 2026-11-12 → 2026-11-19: `generate` / `migrate` were **blocked on main**
  ("Conflicting migrations detected", a branching snapshot chain), and
  migrations were hand-written and verified with `database/migrate-reset.ts`.
- 2026-11-19: the v1 chain (31 steps) was moved to
  `apps/backend/database/migrations-archive/v1` (history only, never applied)
  and replaced by a single baseline migration, `20261120061847_last_daredevil`
  (18 schemas, 164 `CREATE TABLE` statements, 0 cross-schema `REFERENCES`).
- 2026-11-21: that single baseline was re-split into **one migration per
  Postgres schema** — 20 folders, `20261120214111_create_auth_schema` through
  `20261120214130_create_warehouse_schema` — restoring the ADR-0019 property
  that a reader can see which migration introduced which table. The single
  baseline is archived at
  `apps/backend/database/migrations-archive/v3-per-schema-20261121` (history
  only, never applied). The chain is **1 `base` + 19 chained `diff` snapshots**
  in dependency order (`auth` first, then alphabetical), produced by
  `drizzle-kit generate` against a cumulative `--schema` list — generated, not
  hand-assembled, so `check`/`generate` agree by construction.
- Verified 2026-11-19 (single baseline) and 2026-11-21 (per-schema chain) on
  disposable databases (dropped afterwards): `drizzle:migrate` applied it
  cleanly; `drizzle:seed` ran twice and the second run inserted nothing; a
  second `drizzle-kit generate` printed "No schema changes"; `drizzle-kit check`
  printed "Everything's fine". On 2026-11-20 a fresh disposable database
  (`ims_smoke`) was migrated and seeded again for the live API smoke test. The
  2026-11-21 run additionally proved the split is **equivalent** to the
  archived baseline: the 20 folders concatenate to the same 728 statements, and
  `pg_dump --schema-only` of a database built from the chain is identical to one
  built from the single baseline (9669 lines, 169 tables, 22 schemas, 20 journal
  rows, 0 cross-schema FKs).
- So `generate` and `migrate` work again. New schema changes: edit
  `docs/database/docs.dbml` first, then the Drizzle schema, run
  `bun run drizzle:generate`, inspect the SQL, and apply it to a **disposable**
  database only.

Disposable-database recipe (also used for the reset tooling):

```powershell
docker exec ims-erp-postgres-1 sh -c 'createdb -U "$POSTGRES_USER" ims_erp_scratch'
# point POSTGRES_URL / POSTGRES_DB at ims_erp_scratch for these commands only
bun run database/migrate-reset.ts          # drops every schema, migrates, seeds
bun run database/seeders/index.ts          # second seed run: must insert nothing new
bunx --bun drizzle-kit push --explain      # prints the diff, executes nothing
```

- Never use `drizzle-kit generate --fix-conflicts`.
- Payment gateway secrets are sealed with `PAYMENT_SECRET_KEY`; without it,
  creating a gateway answers 409 "secret not available" (verified 2026-11-20).

Local infra: `docker-compose.yml` publishes no Postgres/Redis ports; the dev
`.env` expects 15432/16379. Use an override file kept outside the repo:

```yaml
services:
  postgres: { ports: ["15432:5432"] }
  redis: { ports: ["16379:6379"] }
```

Rules:
- Never run `drizzle-kit push` or migrations against a database you cannot
  recreate. Push is for disposable DBs only.
- Before a `generate` run, confirm `drizzle-kit check` is clean; if the chain
  looks inconsistent, create a disposable DB, apply the full set from scratch,
  and record the outcome before proceeding.
- `auth:generate` script pins nothing (`auth@latest`) — pin before running.
- Seeds must be idempotent (safe to run twice).

## Docker

Compose provides `postgres` + `redis` (local infra) plus `backend`, `web-admin`,
`web-landing` (:4321) and `web-customer-portal` (:4322) services pulling
published GHCR images (`ghcr.io/okifirsyah404/*`, `docker-compose.yml`); build images from source
with `docker-compose.local.yml`. A source-build backend Dockerfile for local dev
iteration is open backlog work.

The two Astro services are Node standalone servers (`apps/<app>/Dockerfile`:
`astro build`, then a production `node_modules` next to `dist/`). Their
`PUBLIC_*` values are inlined into the client bundle at build time, so they are
Docker build args, not runtime env; server-context values (`ERP_API_BASE_URL`,
`WEB_HANDOFF_SECRET`, …) are runtime env. The portal keeps server-side sessions
on disk (`/app/.astro/session`), mounted as the `portal-sessions` volume.

Published images (ERP-0107): all four apps are pushed to GitHub Container
Registry as `ghcr.io/okifirsyah404/ims-erp-{backend,web-admin,landing,customer-portal}`
by the `main-deploy-*.yml` workflows when a PR touching the app merges into
`main` (tags `sha-<sha>` and `dev`). They log in with the workflow's
`GITHUB_TOKEN` (`packages: write`); no registry secrets. New packages are
private: a server pulls after `docker login ghcr.io` with a PAT that has
`read:packages`, or the packages are made public in their GitHub settings. The
build args come from GitHub repository variables `PUBLIC_WEB_URL`,
`PUBLIC_CUSTOMER_URL`, `PUBLIC_WHATSAPP_NUMBER` (landing) and
`PUBLIC_WEB_URL`, `PUBLIC_SUPPORT_WHATSAPP`, `PUBLIC_SUPPORT_PHONE` (portal);
unset = the app's production defaults. The `main-test-and-build-*` workflows
run `astro check` (with `bun --bun`), `bun test` and an unpushed Docker build
on PRs. Both images run on Bun only (build and `bun dist/server/entry.mjs`);
the portal build relies on the PWA patches in `patches/`, so every Dockerfile
that runs `bun install --frozen-lockfile` copies `patches/` first.

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up postgres redis    # infra for local backend dev
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build web-landing web-customer-portal
```

## Troubleshooting notes

| Symptom | First check |
|---|---|
| Redis connect failures | `REDIS_*` env names |
| Cache entries "stale" for 30 s–5 min diffs | TTL is ms in Keyv, s in Better Auth secondaryStorage |
| A user update is not visible on the read path | Every writer of `auth.users` must evict the shared `user:*` keys (`src/app/user/constants/cache.ts`) — a new write path that forgets this reintroduces 5-minute staleness |
| Backend crashes at startup resolving a controller | A module `container.ts` is missing a token registration (the HR numbering gap, fixed 2026-11-20); the live smoke test booted every controller cleanly afterwards |
| Strange migration warnings | rc-channel drizzle; see `stack-compatibility.md` unresolved issues |
| Auth route body not parsed | Elysia body parsing config; better-auth needs raw bodies for webhooks/sign-up |
| Two modules "share" a route and the wrong handler answers | Check the actual registered paths (`prefix` + sub-path) before assuming mount order; with prefix-wrapped plugins the FIRST registration wins, but a prefix + `.get('/')` registers `/prefix/` (a *different* route) |

## Backup/restore

Not established. Postgres dump/restore commands must be agreed before phase 7;
record the verified approach here once proven. Do not improvise against DBs
you can't recreate.

## Hygiene

- After schema changes: generated migration inspected by a human.
- After touches: run lint + tests in the affected workspace and update
  `progress.md` with the exact commands and outcomes.
