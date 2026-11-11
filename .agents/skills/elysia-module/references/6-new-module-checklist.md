# 3.6 New Module Checklist

**Impact: MEDIUM**

## The Rule

Creating a module means, in order:

1. `src/app/<module>/{contracts,constants,controllers,services,repositories,errors}`
   - plus `queues/` when the module owns background jobs (BullMQ),
     `adapters/` when it implements an external-system port, `utils/`
     for pure helpers, `middleware/` for module middleware/hooks
     (reserved; create only when needed).
   - `services/` contains only `*.service.ts` files; domain errors go in
     `errors/<module>.errors.ts`. "Gateway" naming is reserved for
     websocket gateways — external-system wrappers are adapters.
2. `constants/di.ts` with the module's tokens (see `elysia-tsyringe`)
3. `drizzle/schemas/<module>.schema.ts` with `pgSchema("<module>")`
   — except auth-projecting modules (rule 3.3), which have no schema file.
4. `container.ts` exporting `register<Module>(container)`, called in
   `src/index.ts` after provider registration
5. `index.ts` exporting the module's HTTP entry point:
   `<module>Module()` returns one Elysia instance `.use()`ing every
   controller the module owns, in the module's route order. Mount it in
   `src/app/app.ts` with a single `.use(<module>Module())`; individual
   controllers are never listed there (registration and mounting live in
   different files — see `elysia-tsyringe` rule 2.3)
6. If the module calls an external system, define the port (interface) in
   `contracts/` first and implement it in `adapters/` - before writing
   any call site (see the layered-architecture skill, rule 1.2).
7. No edits to other modules' code. If another module must cooperate,
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
  index.ts              # locationModule() + registerLocation re-export
drizzle/schemas/location.schema.ts  # pgSchema('location'), 4 tables
```

Registered in `src/index.ts`: `registerProvider(container)` →
`registerLocation(container)`. Mounted in `src/app/app.ts` inside
`createApp()`: `.use(locationModule())` — one call per module, never per
controller.

`src/app/user/` is the reference for the two variations — an
auth-projecting module (no schema file, rule 3.3) with an external-system
port and a background job:

```
src/app/user/
  contracts/            # zod contracts + port interfaces (per-domain files)
  constants/di.ts       # USER_REPOSITORY_TOKEN, USER_AUTH_GATEWAY_TOKEN, USER_SERVICE_TOKEN
  controllers/          # user.controller.ts (self route `/me` before `/:userId`)
  errors/               # user.errors.ts, invitation.errors.ts
  adapters/             # better-auth-user.ts, logger-mailer.ts (port impls, no suffix)
  queues/               # avatar.queue.ts + avatar.worker.ts (BullMQ, module-owned)
  repositories/         # user.repository.ts (deletedAt-only writes, cache-aside)
  services/             # user.service.ts, invitation.service.ts (orchestration only)
  utils/                # token.ts (pure helpers)
  container.ts          # registerUser(container)
  index.ts              # userModule() + worker handle + registration re-export
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
- Mounting a controller from `src/index.ts`, or registering a container from
  `src/app/app.ts` — inverting the split makes both files harder to audit.
- Listing individual controllers in `src/app/app.ts`
  (`.use(XController.plugin())`) instead of one `.use(<module>Module())`
  per module — the module's route-ordering invariants scatter across the
  root app, and adding a controller becomes a cross-module edit.
- "Just one small change" in another module to make wiring easier — the
  beginning of the entanglement this skill prevents.
- Calling `auth.api`/SDKs inline first and "extracting a port later" —
  the port exists to shape the call sites; define it first.
