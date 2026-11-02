---
name: elysia-layered-architecture
description: Layered backend architecture for this project's Elysia domains - controllers own HTTP only (parse, envelope, status), services orchestrate repositories and external-system ports, repositories own Drizzle queries and caching, contracts and tokens live in contracts/. Use when creating a new domain module, adding endpoints, or reviewing request-flow boundaries in apps/backend. Does NOT cover Elysia plugin mechanics or tsyringe wiring (use elysia-tsyringe) or schema/DI conventions (use tsyringe, drizzle-unix-timestamp).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.3.0"
  dependsOn: elysiajs
  canonicalExample: apps/backend/src/app/location
  secondaryExample: apps/backend/src/app/user
---

# Elysia Layered Architecture

This project structures every backend domain
(`apps/backend/src/app/<domain>/`) in four layers plus optional queues:

```
contracts/   zod schemas + TypeScript interfaces (+ ports for external systems)
constants/   DI tokens (constants/di.ts)
controllers/ Elysia routes: HTTP concerns only
services/    orchestration over repositories and ports; no HTTP, no Drizzle
repositories/ Drizzle queries + cache; implement contracts
queues/      module-owned BullMQ queues + workers (optional; user module)
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

Two mechanics from the user module:

- **Self routes precede param routes.** `GET /me` must be declared
  **before** `GET /:userId`, or Elysia captures `me` as an id parameter.
  Identity comes from the guard-resolved session (`erp.session.user.id`),
  never from client input; self-scoped reads need no permission gate.
- **Empty macro options drop resolved context from handler types.**
  `erp: {}` + destructuring `erp` fails typecheck (Elysia loses the
  macro's resolve contribution). Use a non-empty option object, e.g.
  `erp: { permission: [] }` — see `user.controller.ts`.

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

**External systems enter through ports.** When a module must call an
outside system (Better Auth's `auth.api`, an email provider, a payment
SDK), the calls live behind a contract interface in `contracts/`
implemented in `services/` and injected via a DI token — never called
inline from a controller or service. The service then orchestrates
repository + gateway; domain errors are translated at the gateway edge.

```typescript
// apps/backend/src/app/user/services/user.service.ts — the pattern
constructor(
	@inject(USER_REPOSITORY_TOKEN)
	private readonly userRepository: IUserRepository,
	@inject(USER_AUTH_GATEWAY_TOKEN)
	private readonly authGateway: IUserAuthGateway,
) {}

// Soft delete pairs both collaborators; no Better Auth import here.
async softDeleteUser(userId: string, headers: Headers): Promise<void> {
	await this.ensureExists(userId);
	await this.authGateway.banUser(userId, { banReason: 'deleted' }, headers);
	await this.userRepository.delete(userId);
}
```

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
- Calling `auth.api` (or any external SDK) directly from a controller or
  service without a contract port — untestable, ownership invisible.
- Raw `drizzleDB` writes inside module queues/workers — the avatar worker
  originally wrote `auth.users.image` directly; now resolves the module
  repository via DI token (cache invalidation + soft-delete filtering).
- `erp: {}` as macro options while destructuring `erp` in the handler —
  typecheck failure, see rule 1.1.

## References

- `elysiajs` skill — Elysia route/plugin mechanics.
- `elysia-tsyringe` skill — how controllers resolve services and domains register.
- `drizzle-soft-deletes` skill — repository-level soft-delete conventions.
- `tsdoc` skill — documentation conventions for the public surface.

## Related

- `tsyringe` skill — token and lifetime rules for the classes in each layer.
- `zod` skill — schema authoring for the boundary contracts.
