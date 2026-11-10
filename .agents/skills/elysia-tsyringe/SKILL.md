---
name: elysia-tsyringe
description: Wiring Elysia controllers to tsyringe in this project - controllers exposed as static plugin() factories, container.resolve only inside plugin(), domain container.ts exports register<X>(container) called from src/index.ts while src/app/app.ts mounts the plugins via a createApp() factory, tokens in constants/di.ts, reflect-metadata at the entrypoint (required on Bun too), one path-param name per position, and plugin-local onError mapping validation errors to the response envelope. Use when creating or wiring a domain controller, mounting routes, or debugging route/resolution crashes in apps/backend. Layering rules (what each layer may do) live in elysia-layered-architecture; token/lifetime rules in tsyringe.
license: MIT
metadata:
  author: OpenAgentic
  version: "1.1.0"
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

One plugin per controller; each module groups its controllers behind a
`<module>Module()` factory in `index.ts`. The factory builds the Elysia
instance and returns it; the entrypoint mounts it with `.use()`.

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

// src/app/app.ts — the root app mounts module factories, not controllers
export function createApp() {
	return new Elysia()
		.mount(auth.handler)
		.use(openapi({ path: '/docs', documentation: betterAuthOpenApiDocument }))
		.use(locationModule());
}

// src/app/location/index.ts — the module entry point groups its controllers
export function locationModule() {
	return new Elysia({ name: 'location' }).use(LocationController.plugin());
}

// src/index.ts — registration and cross-cutting plugins only
registerProvider(container);
registerLocation(container);
const bootstrap = new Elysia()
	.use(wrap(pinoLogger))
	.use(createApp())
	.listen(appConfig.app.port);
```

Name the plugin (`name`) so Elysia deduplicates hooks on hot reload.

`createApp()` is a factory, not `export const app`. Controllers resolve
inside `plugin()`, so the container must be populated first; a module-level
instance would build at import time and make correctness depend on hoisted
import order between `app.ts` and `index.ts`.

### 2.2 `container.resolve` inside `plugin()` only — CRITICAL

Resolved once per app lifetime at plugin build time, closed over by the
route handlers. Never per-request, never inside a service or repository,
never `new Service()`.

### 2.3 Domain `container.ts` exports `register<X>(container)` — CRITICAL

Called from the composition root (`src/index.ts`) after provider
registration. Order matters: `registerProvider(container)` (Drizzle,
Redis) must precede `registerLocation(container)` or repositories resolve
without their connections. Registration lives in `src/index.ts`; mounting
the resulting plugins lives in `src/app/app.ts` — keep the two apart.

```typescript
// src/index.ts
registerProvider(container);
registerLocation(container);
```
### 2.4 Tokens live in `constants/di.ts` — HIGH

The container re-exports them. Prevents the service ↔ container circular
import (see `elysia-layered-architecture` rule 1.4).

### 2.5 `import 'reflect-metadata'` at the entrypoint — HIGH

Required even on Bun. First line of `src/index.ts`. Bun emits
`design:paramtypes` natively, but tsyringe's CJS entry checks
`Reflect.getMetadata` at load and throws without the polyfill. Removing it
crashes boot: `tsyringe requires a reflect polyfill`. See the `tsyringe`
skill, rule 2.1.

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
- Listing individual controllers in `src/app/app.ts` — mount
  `<module>Module()` factories instead; module-internal route ordering
  stays inside the module.
- `scope: 'local'` in `.onError` options — the option is `as: 'local'`.
- Local helpers named `error`/`status` inside `plugin()`.

## References

- `elysiajs` skill — plugin composition, hooks, error lifecycle.
- `tsyringe` skill — tokens, lifetimes, composition root rules.
- `elysia-layered-architecture` skill — what each layer may do.

## Related

- `drizzle-soft-deletes` skill — repository behavior behind the resolved services.
- `tsdoc` skill — documenting controllers and services.
