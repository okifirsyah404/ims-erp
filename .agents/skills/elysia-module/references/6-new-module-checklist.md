# 3.6 New Module Checklist

**Impact: MEDIUM**

## The Rule

Creating a module means, in order:

1. `src/app/<module>/{contracts,constants,controllers,services,repositories}`
2. `constants/di.ts` with the module's tokens (see `elysia-tsyringe`)
3. `drizzle/schemas/<module>.schema.ts` with `pgSchema("<module>")`
4. `container.ts` exporting `register<Module>(container)`, called in
   `src/index.ts` after provider registration
5. No edits to other modules' code. If another module must cooperate,
   invert: the other module exposes a token/service, or (later) a domain
   event.

## Canonical Example (from this repo)

`src/app/location/` is the reference checklist run end-to-end:

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

## Why

- The same checklist every time keeps modules structurally identical —
  navigation and review are pattern-matching, not exploration.
- The no-cross-module-edits rule forces dependency inversion early, before
  entanglement is cheap.

## Anti-patterns

- Creating the schema file but not the module (or vice versa) — half a
  module.
- Registering the module but mounting no controller, or mounting routes
  without registering (resolution failures at first request).
- "Just one small change" in another module to make wiring easier — the
  beginning of the entanglement this skill prevents.
