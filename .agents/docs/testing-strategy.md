# Testing Strategy

Unit, integration, and e2e boundaries. Distinguish automated success from
business acceptance: passing tests is evidence of correct code, not
acceptance of a feature.

## Current tooling

- Vitest 4, globals on, per-workspace configs.
  - `apps/backend-elysia` currently has **no test script** — add
    `vitest.config.ts` (unit: `test/**/*.spec.ts`) and `test:e2e` when the
    first slice lands.
- Plain Elysia/Bun test setup (`bun:test` or vitest) with constructor-injected
  mocks for collaborators; no DI container to patch.
- No Docker/testcontainers wiring exists yet — integration tests target a
  real local PostgreSQL configured by env names (`POSTGRES_HOST`, `POSTGRES_PORT`,
  `POSTGRES_USER`, `POSTGRES_DB`, disposable DB values supplied per run).

## Test pyramid

| Layer | Location | Scope | Dependencies |
|---|---|---|---|
| Unit | `apps/backend-elysia/test/unit/<domain>/{routes,services}` | use cases with mocked repositories; route validation/status/permissions with mocked services | mocks only |
| Integration (real PG) | `apps/backend-elysia/test/integration` (to be introduced) | migrations applied, constraints (unique/23505, FK), pagination counts, soft-delete filtering, relational-v2 queries exercising real relationships | disposable PostgreSQL |
| e2e | `apps/backend-elysia/test/e2e` (to be introduced) | real HTTP against the booted app: session flow, authorization denial, write success, deactivation | disposed app + PG |
| Frontend | not established yet | component/query tests when slices land; route tree generated, never hand-edited | — |

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
4. **Successful writes** — create/update deactivate flows, cache eviction
   verified where caches are involved.
5. **Deactivation / soft delete** — list/detail disappear, restore possible,
   hard delete is never exposed.
6. **Race handling** — duplicate code insert (PG `23505`) surfaces as 409
   once, and concurrent inserts cannot produce duplicate alive rows.
7. **Relational v2** — at least one real query exercising an actual declared
   relationship when the model has one (never invent a demo relationship).
8. **Migration integrity** — new migrations apply on a clean disposable DB and
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
failures must be listed in `project-audit.md` before new test failure
reporting can be trusted.
