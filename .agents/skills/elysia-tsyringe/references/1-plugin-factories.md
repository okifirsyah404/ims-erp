# 2.1 Expose Controllers as Static plugin() Factories

**Impact: CRITICAL**

## The Rule

One plugin per domain module. The controller exposes a static `plugin()`
factory that builds and returns the Elysia instance; the root app in
`src/app/app.ts` mounts it with `.use()`.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts`:

```typescript
export class LocationController {
	static plugin() {
		const locationService = container.resolve<LocationService>(
			LOCATION_SERVICE_TOKEN,
		);

		return new Elysia({
			prefix: '/locations',
			name: 'location',
			tags: ['Location'],
		})
			.get('/provinces', /* ... */);
	}
}

// src/app/app.ts — the root app owns every controller mount
export function createApp() {
	return new Elysia()
		.mount(auth.handler)
		.use(openapi({ path: '/docs', documentation: betterAuthOpenApiDocument }))
		.use(LocationController.plugin());
}

// src/index.ts — registration and cross-cutting plugins only
registerProvider(container);
registerLocation(container);
const bootstrap = new Elysia()
	.use(wrap(pinoLogger))
	.use(createApp())
	.listen(appConfig.app.port);
```

## Why

- `name` on the plugin lets Elysia deduplicate hooks across hot reloads.
- A factory (not a top-level instance) keeps plugin build order explicit:
  the caller decides when resolution happens.
- One plugin per domain keeps route prefixes and OpenAPI tags consistent.
- `createApp()` is itself a factory: controllers resolve inside `plugin()`,
  so the container must be populated before the app is built. A module-level
  `export const app` would build at import time, making correctness depend on
  hoisted import order.

## Anti-patterns

- Exporting a bare `Elysia` instance from the controller module — builds
  and resolves at import time, order becomes implicit.
- Mounting routes directly on the root app in `src/index.ts` — bypasses
  the domain boundary, and the controller list stops being one readable block.
- Building the root app eagerly (`export const app = new Elysia()...`) in
  `src/app/app.ts` — import-order-dependent container resolution.
- Forgetting `name`/`seed` on shared plugins — hooks run twice on reload.
