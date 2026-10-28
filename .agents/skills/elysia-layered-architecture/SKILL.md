---
name: elysia-layered-architecture
description: Layered backend architecture for this project's Elysia domains - controllers own HTTP only (parse, envelope, status), services orchestrate, repositories own Drizzle queries and caching, contracts and tokens live in contracts/. Use when creating a new domain module, adding endpoints, or reviewing request-flow boundaries in apps/backend. Does NOT cover Elysia plugin mechanics or tsyringe wiring (use elysia-tsyringe) or schema/DI conventions (use tsyringe, drizzle-unix-timestamp).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: elysiajs
  canonicalExample: apps/backend/src/app/location
---

# Elysia Layered Architecture

This project structures every backend domain
(`apps/backend/src/app/<domain>/`) in four layers:

```
contracts/   zod schemas + TypeScript interfaces
constants/   DI tokens (constants/di.ts)
controllers/ Elysia routes: HTTP concerns only
services/    orchestration over repositories; no HTTP, no Drizzle
repositories/ Drizzle queries + cache; implement contracts
container.ts registration of the domain's classes (see elysia-tsyringe)
```

Request flow: HTTP → controller (parse → envelope) → service → repository → DB/cache.
Dependencies point one way: toward `contracts/`. A layer never skips the one
below it, and never reaches sideways into another domain's repository.

## When to Apply

Reference these guidelines when:

- Creating a new domain module under `apps/backend/src/app/<domain>/`
- Adding endpoints or routes to an existing domain
- Deciding where a piece of logic belongs (parsing, caching, querying)
- Reviewing a pull request that crosses layer boundaries
- Debugging "wrong layer" smells (HTTP shapes in repositories, queries in services)

## The 6 Rules (by impact)

### 1.1 Controllers own HTTP only — CRITICAL

Controllers parse input, build the response envelope, and map statuses.
They never import Drizzle schemas/tables and never contain business logic.

```typescript
// apps/backend/src/app/location/controllers/location.controller.ts — the pattern
.get('/provinces', async ({ query }) =>
	okPaginated(
		await locationService.paginateProvinces(provinceQuerySchema.parse(query)),
	),
)
```

Imports allowed in a controller: Elysia, zod contracts from `contracts/`,
DI tokens, the service type, `@ims-erp/common` envelope types. Anything
else is a boundary violation.

### 1.2 Services orchestrate, never touch HTTP or Drizzle — HIGH

Services refine/combine repository results and translate domain errors.
No `Request`/`Response` types, no `db.select(...)`, no cache calls.

```typescript
// apps/backend/src/app/location/services/location.service.ts — the pattern
getRegenciesByProvince(provinceId: string): Promise<TRegencySelect[]> {
	return this.regencyRepository.findByProvinceId(provinceId);
}
```

A pass-through service is fine. The layer exists so controllers can be
swapped and repositories can be tested without HTTP.

### 1.3 Repositories own queries and caching — HIGH

All Drizzle queries, soft-delete filters, and Redis cache-aside logic live
in repositories behind interfaces from `contracts/`. Services and
controllers see data, not SQL.

See `drizzle-soft-deletes` for the soft-delete rules and `tsyringe` for how
repositories receive `DRIZZLE_TOKEN`/`REDIS_TOKEN`.

### 1.4 Contracts in `contracts/`, DI tokens in `constants/di.ts` — CRITICAL

Zod request/response schemas and repository interfaces belong in
`contracts/`. DI token symbols belong in `constants/di.ts` — a standalone
module so services and the composition root can both import them without
a circular dependency. Canonical:
`apps/backend/src/app/location/constants/di.ts` — extracting it fixed a
real `Cannot access 'PROVINCE_REPOSITORY_TOKEN' before initialization`
crash.

### 1.5 Response envelope at the HTTP layer only — MEDIUM-HIGH

`TApiResponse<T>` / `TApiPaginatedResponse<T>` from `@ims-erp/common` are
built in controllers. Repositories return `TPaginationResult<T>`; the
controller maps it into the envelope. Services never construct envelope
metadata (`requestId`, `timestamp`, HTTP status).

### 1.6 Zod parse at the boundary — MEDIUM

Raw query/body objects are parsed in the controller
(`schema.parse(query)`) before any service call. Services and repositories
receive parsed, typed values only — never `Record<string, unknown>`.

## Anti-patterns (from real incidents in this repo)

- String injection tokens (`@inject('IProvinceRepository')`) inside
  services — silent runtime resolution failure.
- Value-importing TypeScript interfaces in Bun (`import { IProvinceRepository }`)
  — Bun keeps type-only named imports at runtime and crashes with
  `Export named 'IProvinceRepository' not found`. Use `import type`.
- Envelope construction in a service or repository.
- A repository returning HTTP error shapes (`{ message: 'Not found' }`).

## References

- `elysiajs` skill — Elysia route/plugin mechanics.
- `elysia-tsyringe` skill — how controllers resolve services and domains register.
- `drizzle-soft-deletes` skill — repository-level soft-delete conventions.
- `tsdoc` skill — documentation conventions for the public surface.

## Related

- `tsyringe` skill — token and lifetime rules for the classes in each layer.
- `zod` skill — schema authoring for the boundary contracts.
