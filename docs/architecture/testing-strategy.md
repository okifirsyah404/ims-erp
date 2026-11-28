# Testing Strategy

Unit, integration, and e2e boundaries. Distinguish automated success from
business acceptance: passing tests is evidence of correct code, not
acceptance of a feature.

## Current tooling

- **Backend (`apps/backend`): `bun test`** (Bun built-in, zero extra runner
  deps), config in `bunfig.toml`, tests in `test/unit/`, shared mocks in
  `test/helpers/mock-db.ts`. Conventions: `.agents/skills/bun-test`
  (DB + Redis always mocked via constructor injection, no network, no real
  connection strings). `reflect-metadata` preload required for tsyringe.
- Frontend/other workspaces: not established yet.
- No Docker/testcontainers wiring exists yet - integration tests, when
  introduced, target a real local PostgreSQL configured by env names
  (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_DB`,
  throwaway local DB values supplied per run).

## Test pyramid

| Layer | Location | Scope | Dependencies |
|---|---|---|---|
| Unit | `apps/backend/test/unit/` | services with mocked repositories (pass-through, null propagation); repositories with mocked Drizzle chain + Redis client (soft-delete filter construction, cache-aside flow, TTL 300, write invalidation) | mocks only, fully offline |
| Integration (real PG) | not yet introduced | migrations applied, constraints (unique/23505, FK), pagination counts, soft-delete filtering against real data | a throwaway local PostgreSQL |
| e2e | `apps/backend/test/e2e/` (empty, reserved) | real HTTP against the booted app: session flow, authorization denial, write success, deactivation | disposed app + PG |
| Frontend | not established yet | component/query tests when slices land; route tree generated, never hand-edited | - |

## Husky pre-commit

`.husky/pre-commit` runs `bun run lint` + `bun run test` at repo root via
Turborepo; the `test` task is `cache: false` so a cached PASS can never mask
stale state. `build` stays out of the hook (too slow).

## Fixture policy

- Synthetic data only, seeded through the existing runner
  (`database/seeders`); idempotent — running twice must be safe.
- Never hardcode production credentials; never reuse `.env` secrets in tests.
- Indonesian address fixtures come from `database/seeders/raw/addresses/*`
  through the seeding path, not copied into tests ad-hoc.
- Each integration test creates and cleans its own rows (unique code prefixes)
  or uses a dedicated schema so suite ordering cannot corrupt results.

## Required coverage per slice

1. **Authorization** — authenticated low-privilege user cannot get write
   access by calling the endpoint directly (deny + status).
2. **Ownership** — customer A cannot read customer B; investor A cannot read
   investor B; the same shape for any linked-identity resource.
3. **Validation** — zod boundary rejects malformed bodies with field-clear
   400s; phone/address rules respect Indonesian conventions (no international
   phone-format obsession).
   Since P7-6 a validation test asserts the `field` and `key` of **every**
   error, not only the status (`test/unit/http-plugin-validation.test.ts`
   mounts the plugin behind the real i18next wiring and checks the
   Indonesian text). A form's shared schema is tested once in the backend
   (`zodIssuesToFormErrors(schema.safeParse(x).error.issues, x)`) and the web
   side tests the envelope reader and field mapping
   (`apps/web-admin/test/unit/api-error.test.ts`).
4. **Successful writes** — create/update deactivate flows, cache eviction
   verified where caches are involved.
5. **Deactivation / soft delete** — list/detail disappear, restore possible,
   hard delete is never exposed.
6. **Race handling** — duplicate code insert (PG `23505`) surfaces as 409
   once, and concurrent inserts cannot produce duplicate alive rows.
7. **Relational v2** — at least one real query exercising an actual declared
   relationship when the model has one (never invent a demo relationship).
8. **Migration integrity** — new migrations apply on a clean throwaway local DB and
   seeding twice is safe.

## Financial/audit scenarios (from phase 4 onward)

- Posted journals balance; retries/idempotency: same payment twice posts once.
- Subledger ↔ GL control reconciliation; balance sheet equation.
- Period-close rejection of unauthorized posting; reopening audited.
- Gateway webhook: duplicate/out-of-order events are safe; browser redirect is
  never proof of payment.
- License activation: replay-safe; refund/reversal consequences pre-defined
  before implementation.

## Recording results

Test outcomes belong in `progress.md` with exact commands. Pre-existing
failures must be listed in `docs/plan/progress.md` before new test failure
reporting can be trusted.
