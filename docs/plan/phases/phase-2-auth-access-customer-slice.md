# Phase 2 — Auth/Access Integration + Customer Reference Slice

- **Owner:** A (backend) + B (frontend), jointly.
- **Depends on:** Phase 1 (completed docs/audit; pre-existing failures catalogued).

## Entry criteria
- Disposable PostgreSQL reachable via env names (`POSTGRES_*`); Redis
  available or its absence handled and documented.
- Pre-existing test failures understood (baseline: 7/32 spec files failing for
  known import-design reasons, per `project-audit.md`).

## Work (ERP-0002 → 0003 → 0004/0005/0006 as dependencies allow)

**A — backend**
1. ERP-0002 authorization core: implement
   `src/core/authorization/{permissions.ts, authorization.service.ts}` so the
   pre-written `roles`/`ownership` specs pass without weakening them; resolve
   the empty `role-permission.ts`; keep the permission list byte-consistent
   with `apps/web-admin/src/lib/permissions.ts`.
2. ERP-0003 auth module: build `src/modules/auth` until `auth.controller` /
   `auth.service` suites pass; **runtime-proof login/logout/session on a real
   boot** (real HTTP, cookies, guard denial, CORS/trusted origins vs
   `VITE_API_URL`).
3. ERP-0004 customer slice backend: migration (code/address columns; partial
   unique), validated DTOs, list/detail/create/update/deactivate endpoints,
   ownership checks, `23505 → 409`, transaction + audit-log writes, cache
   discipline (per `api-conventions.md`).
4. ERP-0006 address model: seeded reference tables from raw JSON (idempotent,
   provable by running twice), cached lookup endpoint; **no address JSON in
   the browser bundle**.
5. ERP-0005-adjacent user-module repairs: resolve user stub-suite failures.

**B — frontend**
1. Authenticated shell: wire login flow to real backend session (replace
   sample sidebar content with real nav; Indonesian labels).
2. ERP-0005 customer feature slice: `features/customer{api,schemas,components,
   hooks}`; `/customers` route composed into the persisted sidebar; TanStack
   Query mutations with correct invalidation; TanStack Form + zod;
   loading/empty/error/unauthorized states.
3. Address lookup per ERP-0006 (cascading selects against the API).

## Exit criteria — all required, not optional
- Login/session proven against a running server (manual + e2e), guard denies
  unauthenticated access to protected endpoints.
- Low-privilege authenticated user cannot gain customer write access by direct
  endpoint call (test evidence).
- Customer CRUD + deactivate work end-to-end; data persists across reload;
  query invalidation correct.
- New migration applied to a disposable DB; seeding twice safe (command output
  recorded).
- Real-PG integration coverage: unique-code race, ownership, pagination,
  soft-delete filtering; Relational-v2 query exercising a real declared
  relationship.
- Pre-existing auth/customer/user test suites pass (or be reduced to named,
  blocking-but-separate failures in `progress.md`).
- Backend lint + tests green in the touched scopes; web-admin build green.

## Outputs
- Working customer vertical slice: route, page, API, migration, seed, tests.
- `progress.md` evidence entries; ERP-* statuses updated in `backlog.md`.

## Risks
- **Auth runtime behavior unverified until step 2 completes** — the biggest
  unknown in the repo; if the integration misbehaves, fallback is fixing the
  wiring, never swapping auth stacks.
- Address seeding (raw JSON size/hierarchy) may expose data-quality issues in
  `regencies`/`districts`/`villages` files; corrections happen via seed
  refinement, not code-embedded workarounds.
