> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Infrastructure Modules

## Purpose and boundary

Platform code shared by everything: configuration, bootstrap wiring, the
Drizzle client/clients, schemas and shared custom types, cache (Keyv/Redis),
and queues. Owns no business rules. Domain code consumes these through DI
tokens/contracts, never by re-creating pools or caches.

## Configuration (`src/config/*`)

- **Implemented** (verified by compilation/inspection, not runtime): zod
  schemas (`config.schema.ts`) for instance/app/database/redis/s3; loader
  (`config.loader.ts`) reads `.env`; exported typed `config`.
  - Env variable names: `NODE_ENV`, `TZ`, `APP_NAME`, `APP_ID`, `APP_SECRET`,
    `APP_HOST`, `APP_PORT`, `APP_URL`, `APP_LOG_LEVEL`, `POSTGRES_*`,
    `REDIS_*`, `S3_*` — values never printed/committed.
  - Flag: `dotenv-expand` version `1000.0.0` suspicious; verify expansion
    when touching config.
- Runtime startup validation (ConfigModule + zod) is in place via
  `ConfigModule.forRoot({ isGlobal: true, load: [() => config] })`.

## Bootstrap (`src/bootstrap.module.ts`)

- DrizzleModule `forRootAsync({ db: drizzleDB })` → `@InjectDrizzle()` token.
- CacheModule: `ttl: 300_000` (**ms**), `namespace: 'ims-erp'`, store =
  Keyv instance (Redis-backed). Deprecated-config risk: cache-manager 7 —
  watch warnings.
- BullModule: connection from `redis.*` (`REDIS_QUEUE_DB` optional),
  `defaultJobOptions.attempts: 3`.
- AppModule (auth + 14 domain modules) imported as the app tree.

## Drizzle client and schemas (`src/providers/drizzle/*`)

- `drizzle.ts`: `drizzle({ connection: config.database.url!, relations:
  {...authRelations, ...erpRelations} })` — Relational **v2**
  (`defineRelationsPart`); v1 relations prohibited (ADR-0004).
- `schemas/auth-schema.ts` — Better Auth-owned (generated; never hand-edit).
- `schemas/erp-schema.ts` — business tables: `audit_logs`, `customers`,
  `investors` (all with unix-ms timestamps + `deleted_at`).
- `schemas/unix-timestamp.ts` — shared custom types (`Date` at app layer, ms
  at driver layer).
- Repository rule (ADR-0005): repositories must use `@InjectDrizzle()`;
  the singleton is for bootstrap (auth adapter, seeders/CLI). Scaffold-era
  files importing `drizzleDB` in repositories are defects to fix in their
  slices (known: `customer.repository.ts`).
- Migration policy: append-only; `drizzle:generate` → inspect → apply to
  disposable DB. Journal state of the baseline
  (`20261025064638_create_auth_schema`) unverified — check before first
  generate/migrate.

## Cache (Keyv/Redis, `src/providers/keyv/*`)

- Two instances: `keyvInstance` (general) and `keyvRedisInstance` (also used
  by Better Auth `secondaryStorage.increment`).
- TTL units: CacheModule ms; Better Auth secondary storage seconds. Never mix.
- Cache rules scoped cache keys to the authorization boundary or id
  (`user:<id>` pattern); evict after commit; lists bypass cache
  (see `../api-conventions.md`).

## Failure notes / risks

- All providers verified present and wired; **behavioral verification**
  (connect, cache hit/miss, queue round-trip) pending phase-2 runtime run.
- Redis being unavailable currently breaks boot paths using it; decide a
  documented fallback before phase-2 (tracked in `../runbook.md` troubleshooting).

## Tests

- No infrastructure tests exist; integration tests (test/int) will cover
  connection, cache round-trip, and idempotent seeding on a disposable PG.
