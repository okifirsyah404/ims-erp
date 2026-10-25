# Architecture

Ownership boundaries, dependency rules, and integration patterns. Violations
here should fail review even if tests pass.

## Layering (backend)

```text
src/
├── main.ts                 Fastify bootstrap; bodyParser: false (auth
│                           raw-body requirement); Swagger (currently
│                           placeholder "Cats" metadata — replace later)
├── bootstrap.module.ts     ConfigModule (global, zod-validated),
│                           DrizzleModule, CacheModule (Keyv/Redis),
│                           BullModule, AppModule
├── config/                 env loading → zod validation → typed `config`
├── providers/              infrastructure singletons
│   ├── better-auth/        auth instance + options + (planned) role mapping
│   ├── drizzle/            `drizzleDB` client; schemas are code-owned
│   │   └── schemas/        auth-schema.ts (auth.*), erp-schema.ts (erp.*),
│   │                       unix-timestamp.ts (bigint ms types)
│   └── keyv/               Keyv + Redis instances
├── core/                   (planned) cross-cutting, module-agnostic logic
│                           — authorization (permissions.ts,
│                             authorization.service.ts, erpRoles)
└── modules/<domain>/       domain boundary; see table below
    └── controllers │ services │ repositories (+ contracts/, dto/ where used)
```

## Module responsibility rules

- **Controllers** — HTTP shape only: routing, `@thallesp/nestjs-better-auth`
  auth/guard context, DTO validation enforcement, status codes, response
  contracts. No Drizzle, no business rules.
- **Services** — use cases and business rules; ownership/permission checks;
  transaction boundaries (services decide and pass a transaction-scoped DB
  handle into repositories so every write in one use case shares one
  transaction).
- **Repositories** — persistence queries only, injected via `@InjectDrizzle()`
  (`@nestjs/drizzle`). **Never import the `drizzleDB` singleton from a
  repository**; the singleton exists for provider bootstrap (auth adapter,
  config) only — see ADR-0005. The existing `customer.repository.ts` importing
  `drizzleDB` directly is a scaffold-era violation to fix in Phase 2.
- **DTOs/contracts** — follow the established pattern:
  `contracts/<x>.repository.contract.ts` for repository interfaces,
  `dto/<x>.dto.ts` for transport types, zod at boundaries (config schema
  already does this).
- **Cross-domain access** — export a narrow service/contract from the owning
  module. Importing another domain's repository is prohibited. Avoid
  `forwardRef` entirely.
- **Cross-feature isolation (modular monolith)** — a feature module never
  touches another feature's data at the DB level: no cross-feature FK
  constraints, joins, or Drizzle relations, and no importing another feature's
  table objects. Each feature owns a Postgres schema named after the domain;
  cross-feature references are loose ID columns with integrity enforced in the
  owning service. The only cross-module surface is an exported
  `External<X>Service` facade (see `nestjs-layered-architecture` skill).
  Exception: `auth-schema.ts` tables are Better Auth-managed shared
  infrastructure (the existing `erp.audit_logs.actor_id → auth users.id` FK is
  allowed).
- **Cache discipline** — cache only suitable read paths; keys must be scoped by
  the real authorization boundary (company) or primary key; evict after
  successful mutations. Authorization/financial correctness never depends on
  cached data.

## Existing reference implementation

`modules/user/` is the pattern to copy:
- `contracts/user.repository.contract.ts` (interface) +
  `dto/user.dto.ts` (transport types)
- repository: `@InjectDrizzle()` + `@Inject(CACHE_MANAGER)`, pagination
  envelope `TPaginationResult<T>` from `@ims-erp/common`, soft-delete-only
  reads, cache-aside by id with revival of date-typed fields after JSON roundtrip
- `user.module.ts` wiring

## ERP schema ownership

- `auth` schema: Better Auth-owned tables, regenerated only from
  `auth:generate` (never by hand, never blindly). -
- `erp` schema: current shared domain schema (`audit_logs`, `customers`,
  `investors`). Owned by this repo. **Do not grow it further**: new feature
  tables get a per-feature Postgres schema named after the domain
  (`customer.*`, `sales.*`, ...) per the cross-feature isolation rule. Migrate
  existing non-audit tables into their feature schemas as each feature is
  built. Relations live in v2 `defineRelationsPart`
  blocks per schema file, combined in `drizzle.ts`. Relations do **not**
  replace PostgreSQL FKs, unique constraints, checks, or indexes — add both
  (within a single feature's schema only; cross-feature references are loose
  IDs).

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

Services own transactions. A multipurpose case writes: acquire transaction
handle via the `@nestjs/drizzle`-injected client, pass the tx-scoped handle to
affected repositories, commit/rollback in the service, invalidate affected cache
keys only after commit. Side effects to external systems (webhooks, WhatsApp,
licensing) occur after local commit; outbox/wire format decisions are deferred
until those phases.
