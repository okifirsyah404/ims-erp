---
name: elysia-tsyringe
description: Wiring Elysia controllers to tsyringe in this project - controllers exposed as static plugin() factories, container.resolve only inside plugin(), domain container.ts exports register<X>(container) called from src/index.ts, tokens in constants/di.ts, reflect-metadata at the entrypoint, one path-param name per position, and plugin-local onError mapping validation errors to the response envelope. Use when creating or wiring a domain controller, mounting routes, or debugging route/resolution crashes in apps/backend. Layering rules (what each layer may do) live in elysia-layered-architecture; token/lifetime rules in tsyringe.
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  dependsOn: elysiajs
  canonicalExample: apps/backend/src/app/location
---

# Elysia × tsyringe Wiring

The seam between Elysia plugins and the tsyringe container: how a domain's
controller becomes a mounted Elysia plugin while resolving its service from
DI. The `elysiajs` skill excludes DI; the `tsyringe` skill excludes routes.
This skill covers the junction, using the location domain as canonical example.

## When to Apply

Reference these guidelines when:

- Creating or mounting a domain controller
- Deciding where `container.resolve` may appear
- Registering a new domain's classes in the composition root
- Debugging route-registration conflicts, resolution failures, or
  "reflect-metadata" crashes

## The 7 Rules (by impact)

### 2.1 Expose controllers as static `plugin()` factories — CRITICAL

One plugin per domain module. The factory builds the Elysia instance and
returns it; the entrypoint mounts it with `.use()`.

```typescript
// apps/backend/src/app/location/controllers/location.controller.ts — the pattern
export class LocationController {
	static plugin() {
		const locationService = container.resolve<LocationService>(
			LOCATION_SERVICE_TOKEN,
		);

		return new Elysia({ prefix: '/locations', name: 'location', tags: ['Location'] })
			.get('/provinces', /* ... */);
	}
}

// src/index.ts
const bootstrap = new Elysia()
	.use(wrap(pinoLogger))
	.use(elysiaApp)
	.use(LocationController.plugin())
	.listen(appConfig.app.port);
```

Name the plugin (`name`) so Elysia deduplicates hooks on hot reload.

### 2.2 `container.resolve` inside `plugin()` only — CRITICAL

Resolved once per app lifetime at plugin build time, closed over by the
route handlers. Never per-request, never inside a service or repository,
never `new Service()`.

### 2.3 Domain `container.ts` exports `register<X>(container)` — CRITICAL

Called from the composition root (`src/index.ts`) after provider
registration. Order matters: `registerProvider(container)` (Drizzle,
Redis) must precede `registerLocation(container)` or repositories resolve
without their connections.

```typescript
// src/index.ts
registerProvider(container);
registerLocation(container);
```

### 2.4 Tokens live in `constants/di.ts` — HIGH

The container re-exports them. Prevents the service ↔ container circular
import (see `elysia-layered-architecture` rule 1.4).

### 2.5 `import 'reflect-metadata'` at the entrypoint — HIGH

Required even on Bun. First line of `src/index.ts`. Without it the server
crashes at boot: `tsyringe requires a reflect polyfill`.

### 2.6 One path-param name per position — MEDIUM

Elysia's router (memoirist) rejects two different param names at the same
position. Child-collection routes use `/:id`, not `/:parentCode`:

```typescript
// OK:  /provinces/:id and /provinces/:id/regencies
// FAIL: /provinces/:id and /provinces/:provinceCode/regencies
//   → Error: Cannot create route with parameter "provinceCode" because a
//     route already exists with a different parameter name ("id")
```

### 2.7 Plugin-local `.onError({ as: 'local' })` for validation → envelope — MEDIUM

Map Elysia `VALIDATION` codes and thrown `ZodError`s to the 400 response
envelope. Never shadow the `error` context parameter with a local helper —
rename the helper (real incident: local `error()` broke the handler's
typing; renamed to `errorEnvelope()`).

## Anti-patterns (from real incidents in this repo)

- Resolving the service per route handler — re-resolves the graph on every
  request and defeats the once-per-lifetime pattern.
- Mounting routes before `registerProvider` has run — repositories inject
  `undefined` connections.
- `scope: 'local'` in `.onError` options — the option is `as: 'local'`.
- Local helpers named `error`/`status` inside `plugin()`.

## References

- `elysiajs` skill — plugin composition, hooks, error lifecycle.
- `tsyringe` skill — tokens, lifetimes, composition root rules.
- `elysia-layered-architecture` skill — what each layer may do.

## Related

- `drizzle-soft-deletes` skill — repository behavior behind the resolved services.
- `tsdoc` skill — documenting controllers and services.
