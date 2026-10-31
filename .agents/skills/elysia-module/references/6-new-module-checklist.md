# 3.6 New Module Checklist

**Impact: MEDIUM**

## The Rule

Creating a module means, in order:

1. `src/app/<module>/{contracts,constants,controllers,services,repositories}`
   — plus `queues/` when the module owns background jobs (BullMQ).
2. `constants/di.ts` with the module's tokens (see `elysia-tsyringe`)
3. `drizzle/schemas/<module>.schema.ts` with `pgSchema("<module>")`
   — except auth-projecting modules (rule 3.3), which have no schema file.
4. `container.ts` exporting `register<Module>(container)`, called in
   `src/index.ts` after provider registration
5. If the module calls an external system, define the port (interface) in
   `contracts/` first and implement it in `services/` — before writing
   any call site (see the layered-architecture skill, rule 1.2).
6. No edits to other modules' code. If another module must cooperate,
   invert: the other module exposes a token/service, or (later) a domain
   event.

## Canonical Example (from this repo)

`src/app/location/` is the reference checklist run end-to-end for a
persistence-shaped module:

```
src/app/location/
  contracts/            # repository interfaces + zod query contracts
  constants/di.ts       # PROVINCE_REPOSITORY_TOKEN ... LOCATION_SERVICE_TOKEN
  controllers/          # location.controller.ts (static plugin())
  repositories/         # 4 repositories, cache-aside, soft-delete aware
  services/             # location.service.ts
  container.ts          # registerLocation(container)
drizzle/schemas/location.schema.ts  # pgSchema('location'), 4 tables
```

Registered in `src/index.ts`: `registerProvider(container)` →
`registerLocation(container)` → `.use(LocationController.plugin())`.

`src/app/user/` is the reference for the two variations — an
auth-projecting module (no schema file, rule 3.3) with an external-system
port and a background job:

```
src/app/user/
  contracts/            # zod contracts, IUserRepository, IUserAuthGateway (port)
  constants/di.ts       # USER_REPOSITORY_TOKEN, USER_AUTH_GATEWAY_TOKEN, USER_SERVICE_TOKEN
  controllers/          # user.controller.ts (self route `/me` before `/:userId`)
  queues/               # avatar.queue.ts + avatar.worker.ts (BullMQ, module-owned)
  repositories/         # user.repository.ts (deletedAt-only writes, cache-aside)
  services/             # user.service.ts (repo+gateway), better-auth-user.gateway.ts (port impl)
  container.ts          # registerUser(container)
```

## Why

- The same checklist every time keeps modules structurally identical —
  navigation and review are pattern-matching, not exploration.
- The no-cross-module-edits rule forces dependency inversion early, before
  entanglement is cheap.
- Ports-first keeps external SDKs confined to one implementer; retrofitting
  a port around scattered `auth.api` calls is a rewrite.

## Anti-patterns

- Creating the schema file but not the module (or vice versa) — half a
  module.
- Registering the module but mounting no controller, or mounting routes
  without registering (resolution failures at first request).
- "Just one small change" in another module to make wiring easier — the
  beginning of the entanglement this skill prevents.
- Calling `auth.api`/SDKs inline first and "extracting a port later" —
  the port exists to shape the call sites; define it first.
