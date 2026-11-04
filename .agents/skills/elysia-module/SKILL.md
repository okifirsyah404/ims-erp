---
name: elysia-module
description: Modular monolith boundaries for this project's Elysia backend - each module under src/app/<module>/ owns exactly one Postgres schema via drizzle/schemas/<module>.schema.ts, no foreign keys across schemas (plain id columns instead), and cross-module communication is strictly service-to-service (AService -> B2Service via DI tokens). Modules calling external systems define contract ports first; module-owned BullMQ jobs live in queues/ and write through the module repository. Exception- user and organization modules live beside Better Auth in the auth schema because Better Auth owns those tables, and their repositories write a declared column subset only (user deletedAt; everything else via the Better Auth gateway). Use when creating a new module, deciding where a table belongs, adding cross-module references, wiring cross-module communication, or reviewing schema/module coupling in apps/backend. Does NOT cover intra-module layering (use elysia-layered-architecture) or DI mechanics (use elysia-tsyringe).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.5.0"
  dependsOn: elysia-layered-architecture
  canonicalExample: apps/backend/src/app/location
  secondaryExample: apps/backend/src/app/user
---

# Elysia Module Boundaries (Modular Monolith)

Every backend module under `apps/backend/src/app/<module>/` is a vertical
slice with its own persistence boundary:

```
src/app/<module>/                  module code (see elysia-layered-architecture)
drizzle/schemas/<module>.schema.ts one Postgres schema per module: pgSchema("<module>")
```

Modules communicate only through published contracts: schema row types and
DI tokens. Cross-module communication is strictly service-to-service —
`AService` → `B2Service` via DI token injection. Nothing else crosses a
module boundary.

## When to Apply

Reference these guidelines when:

- Creating a new module (folder set + schema file + registration)
- Deciding which module a table belongs to
- Adding a reference from one module's table to another module's entity
- Reviewing imports or queries that cross module lines
- Deciding how user/organization data relates to Better Auth

## The 6 Rules (by impact)

### 3.1 One module = one Postgres schema = one schema file — CRITICAL

Each module pairs with `drizzle/schemas/<module>.schema.ts` declaring its
own `pgSchema("<module>")`. No two modules share a schema; there is no
shared "common" schema.

```typescript
// apps/backend/drizzle/schemas/location.schema.ts — the pattern
export const locationSchema = pgSchema('location');

export const province = locationSchema.table('provinces', { /* ... */ });
```

A schema file with no tables means the module doesn't exist yet —
placeholder files (`document.schema.ts`, `warehouse.schema.ts`, ...) are
reservations; implement the module or don't keep the file.

### 3.2 No FKs across schemas — reference by id, no `.references()` — CRITICAL

Cross-module relations are stored as plain columns without
`.references()`. Integrity across the boundary is enforced at the service
layer. Foreign keys are allowed only **within** a module's own schema.

```typescript
// INSIDE the location schema: FK allowed
provinceId: uuid('province_id').references(() => province.id),

// A row in another module's schema (e.g. employee -> location): plain id
// villageId: uuid('village_id'),   // NO .references() — cross-schema
```

Deleting referenced rows cannot cascade across modules by design; the
owning module decides cleanup explicitly.

### 3.3 Identity/tenant tables belong to auth; user & organization modules project — CRITICAL

The exception to rule 3.1: the `user` and `organization` modules do **not**
get their own Postgres schema. Better Auth generates and owns
`auth.users`, `auth.organizations`, `auth.members` (and siblings) in
`drizzle/schemas/auth.schema.ts`. Those modules read/write those tables via
their own repositories, importing the row types from `auth.schema.ts`.
They never re-declare the tables and never edit the generated file except
to coordinate with the Better Auth codegen (`bun run auth:generate`).

**Write-surface invariant:** the projection module's repository declares
(in its contract TSDoc) the only columns it writes directly; every other
mutation flows through the owning system's API behind a contract port.
User module: `IUserRepository` touches `deletedAt` only — role, ban state,
passwords, and sessions go through `IUserAuthGateway` (Better Auth admin
API). Codegen caveat: `@better-auth/cli generate` (1.4.x) regresses the
schema file — columns are applied as hand-written append-only deltas with
the `additionalFields` declaration in `auth.options.ts` (see rule 3.3's
reference).

### 3.4 Cross-module imports: schema types and DI tokens only — HIGH

Allowed:
- `import type { TUserSelect } from '@drizzle/schemas/auth.schema'` in
  another module's contracts (type-only).
- Resolving another module's service via its token from
  `<module>/constants/di.ts`.

That pair — the foreign service type plus its token — **is** the
service-to-service communication channel (rule 3.5). Nothing else crosses
the line.

Forbidden:
- Importing another module's repositories, controllers, or container.
- Importing anything from `src/app/<other>/` that isn't its `constants/di.ts`
  or a schema row type.
- Value-importing schema types in Bun — use `import type` (Bun keeps
  type-only named imports at runtime and crashes on missing exports).

### 3.5 Cross-module communication is service to service — HIGH

`AService` → `B2Service` via B's DI token is the only sanctioned
cross-module call — never controller → foreign service, never
repository → foreign repository. Direction rules, error translation, and
cycle avoidance are detailed in rule 3.5's reference file.

### 3.6 New module checklist — MEDIUM

1. `src/app/<module>/{contracts,constants,controllers,services,repositories,errors}`
   — plus `queues/` when the module owns background jobs (BullMQ),
   `adapters/` when it implements an external-system port,
   `utils/` for pure helpers, `middleware/` when it owns module
   middleware/hooks (reserved; create only when needed).
   `services/` contains only `*.service.ts` files — never errors,
   gateways, or helpers. "Gateway" naming is reserved for websocket
   gateways; external-system wrappers are **adapters** (`adapters/`,
   no file suffix). Domain errors live in `errors/<module>.errors.ts`.
2. `constants/di.ts` with the module's tokens (see `elysia-tsyringe`)
3. `drizzle/schemas/<module>.schema.ts` with `pgSchema("<module>")`
   — except auth-projecting modules (rule 3.3)
4. `container.ts` exporting `register<Module>(container)`, called in
   `src/index.ts`; mount its `Controller.plugin()` in `src/app/app.ts`
   (registration and mounting live in separate files — see `elysia-tsyringe`
   rule 2.3)
5. If the module owns background jobs, export a **worker handle** from its
   `index.ts` (`start<X>Worker()` returning the shared `QueueWorker` shape —
   `{ onError, close }`). `src/index.ts` registers it in the single
   `startWorkers([...])` array from `@providers/queue/worker-registry`, so a
   new queue is one entry there, not a new handle and a new `SIGTERM` branch.
   The module keeps the BullMQ types, event names and shutdown order; the
   composition root never learns them. Do not mount workers on
   `src/app/app.ts` — that file builds the HTTP app, and a worker's failure
   must not be fatal to it. Construction stays at the call site (after
   `registerProvider` and `register<Module>`), never inside the registry.
6. No edits to other modules' code. If another module must cooperate, invert:
   it exposes a token/service, or (later) a domain event.

## Anti-patterns (real observations in this repo)

- A future `employee` schema with
  `userId: text('user_id').references(() => users.id)` — cross-schema FK
  (rule 3.2); use a plain column.
- `import { users } from '@drizzle/schemas/auth.schema'` (value import) in
  another module's repository — coupling + Bun runtime crash risk.
- A "shared" schema (e.g. `common.lookup_tables`) referenced by multiple
  modules — shared boundaries grow into the god schema this skill exists
  to prevent.
- Copying `auth.users` columns into a new `app_user` table to "decouple"
  — projection modules read auth tables directly (rule 3.3).
- A projection repository writing auth-owned columns (`role`, `banned`,
  `password`) directly — ownership scatters; use the module's gateway
  port (rule 3.3).
- A module queue worker writing `drizzleDB` directly instead of through
  the module repository — loses cache invalidation and soft-delete
  filtering (fixed in `user/queues/avatar.worker.ts`).

## References

- `elysia-layered-architecture` skill — intra-module layering.
- `elysia-tsyringe` skill — registration and token placement.
- `drizzle-soft-deletes` skill — deletion semantics inside a module's schema.
- `drizzle-unix-timestamp` skill — datetime columns in schema files.
- `better-auth-best-practices` skill — the auth schema generation flow.

## Related

- `docs/architecture/architecture.md` — module map and boundaries overview.
