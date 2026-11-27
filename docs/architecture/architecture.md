# Architecture

Ownership boundaries, dependency rules, and integration patterns. Violations
here should fail review even if tests pass.

## Layering (backend — `apps/backend`)

```text
src/
├── index.ts                  Elysia bootstrap (bun run --watch)
├── contracts/                shared contracts (pagination, repositories)
├── providers/                infrastructure singletons
│   ├── better-auth/          auth instance + options + plugins + openapi
│   ├── keyv/                 Keyv + Redis instance
│   └── logger/               logger exporters
└── app/<domain>/             domain boundary
    ├── routes | controllers  HTTP shape only
    ├── services              use cases, business rules, tx boundaries
    └── repositories          Drizzle queries
drizzle/                      Drizzle client + schemas (code-owned)
    ├── container.ts / db.ts
    ├── datatypes/            unix-timestamp.ts (bigint ms types)
    └── schemas/              auth.schema.ts (auth.*), per-feature schemas
```

## Domain responsibility rules

- **Routes/controllers** — HTTP shape only: routing, Better Auth session
  auth/guard context, status codes, response contracts. No Drizzle, no
  business rules.
- **Services** — use cases and business rules; ownership/permission checks;
  transaction boundaries (services decide and pass a transaction-scoped DB
  handle into repositories so every write in one use case shares one
  transaction).
- **Repositories** — persistence queries only, using the Drizzle client from
  `drizzle/container.ts`. Never construct ad-hoc DB clients inside a domain.
- **Contracts/DTOs** — zod at boundaries; transport types derived from Elysia
  route schemas where practical.
- **Dependency injection (tsyringe)** — repositories/services are
  `@injectable()` with constructor `@inject(TOKEN)`; non-class providers
  (db client, cache, config) register under module-scoped `Symbol()` tokens
  in their provider's `container.ts` (see `drizzle/container.ts`); routes
  obtain services via `container.resolve(XService)`. Full rules in the
  `tsyringe` skill (`.agents/skills/tsyringe/`).
- **Cross-domain access** — export a narrow service/contract from the owning
  domain. Importing another domain's repository is prohibited.
- **Cross-domain data isolation (modular monolith)** - a domain never touches
  another domain's data at the DB level: no cross-domain FK constraints, joins,
  or Drizzle relations, and no importing another domain's table objects. Each
  domain owns a Postgres schema named after it; cross-domain references are
  loose, nullable ID columns with presence enforced in the owning service
  (ADR-0014).
  Exception: `auth.schema.ts` tables are Better Auth-managed shared
  infrastructure.
- **Cache discipline** — cache only suitable read paths; keys must be scoped by
  the real authorization boundary (company) or primary key; evict after
  successful mutations. Authorization/financial correctness never depends on
  cached data.

## ERP schema ownership

- `auth` schema: Better Auth-owned tables. `@better-auth/cli` 1.4.x `generate`
  regresses this file (drops `pgSchema('auth')`, pluralized tables, relations —
  verified 2026-10-30): do not run `auth:generate`; apply hand-written,
  append-only edits and mirror the column in Better Auth's
  `user.additionalFields` where applicable.
- `erp` schema: never existed. The shared domain schema in the original plan
  was never created; its tables landed in their own schemas (`audit.audit_logs`,
  `customer.customers`). Do not create it.
- One module owns exactly one Postgres schema (ADR-0024, ADR-0026: 20 schemas today; the current list and owners are in `docs/database/module-ownership.md`, and decisions IV-1/PP-8 add investor and `website` schemas through their ADRs;
  196 tables: `auth`, `location`, `company`, `customer`, `supplier`, `product`,
  `warehouse`, `inventory`, `sale`, `procurement`, `finance`, `tax`, `payment`,
  `project`, `ticket`, `human_resource`, `document`, `notification`, `audit`,
  `automation`). The historical two-schema exception is gone and stayed gone:
  ADR-0026 gave `product` (the SKU master) and `warehouse` (the physical estate)
  their own schemas because reference data does not belong to the stock ledger.
  The `webhook` module has no schema and no
  tables; it is the inbound provider edge and delegates to `payment` and
  `automation` through their exported webhook services. `src/app/user` and
  `src/app/organization` are modules over the `auth` schema.
  Per-module ownership, table counts and contracts:
  `docs/database/module-ownership.md`; tables: `docs/database/docs.dbml`.
- Numbering is per module: each business schema owns a `code_numberings` table
  and a `<Module>NumberingService`; there is no central code-number module.
- New feature tables get a per-feature Postgres schema named after the domain
  per the cross-feature isolation rule. Relations live in v2
  `defineRelationsPart` blocks per schema file, combined in `drizzle.ts`.
  Relations do **not** replace PostgreSQL FKs, unique constraints, checks, or
  indexes — add both (within a single feature's schema only; cross-feature
  references are loose IDs).

## Frontend rules (apps/web-admin)

- Stack fixed: TanStack Router + Query + Form, `@ims-erp/ui`, Better Auth client.
- Incremental structure per feature:

```text
src/features/<feature>/
├── api/          # typed calls + query/mutation definitions
├── components/   # screens, forms, tables
├── hooks/        # feature behavior
└── schemas/      # zod form validation
```

- Routes compose feature components; never edit `routeTree.gen.ts` by hand.
- Server state only via TanStack Query with consistent keys and invalidation;
  forms via TanStack Form; permission checks via `lib/use-permission` are UX
  only — the backend decides.
- `@ims-erp/common` exports browser-safe contracts only. Its repository
  contract is a server abstraction — do not pull it into the bundle. Never
  expose DB clients, secrets, or Node-only modules to the frontend.
- UI copy: Indonesian by default ("Pelanggan", "Faktur", …); keep shared UI
  primitives free of business logic.
- Required UI states for data surfaces: loading, empty, error, validation,
  unauthorized.

## Dependency direction (stable target)

```text
web-admin → (HTTP with session cookies) → backend HTTP API
modules ← core (authorization, shared validation)   ← providers
common  → used by both apps (browser-safe only)
ui      → used by web-admin
```

`@ims-erp/backend` never imports from `web-admin` or `ui`.

## Transactions ownership decision

Services own transactions. A multipurpose case writes: acquire a transaction
handle from the Drizzle client (`drizzle/container.ts`), pass the tx-scoped
handle to affected repositories, commit/rollback in the service, invalidate
affected cache keys only after commit. Side effects to external systems (webhooks, WhatsApp,
license sync) occur after local commit; outbox/wire format decisions are deferred
until those phases.
