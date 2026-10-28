# 2.1 Expose Controllers as Static plugin() Factories

**Impact: CRITICAL**

## The Rule

One plugin per domain module. The controller exposes a static `plugin()`
factory that builds and returns the Elysia instance; the entrypoint mounts
it with `.use()`.

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

// src/index.ts
const bootstrap = new Elysia()
	.use(wrap(pinoLogger))
	.use(elysiaApp)
	.use(LocationController.plugin())
	.listen(appConfig.app.port);
```

## Why

- `name` on the plugin lets Elysia deduplicate hooks across hot reloads.
- A factory (not a top-level instance) keeps plugin build order explicit:
  the caller decides when resolution happens.
- One plugin per domain keeps route prefixes and OpenAPI tags consistent.

## Anti-patterns

- Exporting a bare `Elysia` instance from the controller module — builds
  and resolves at import time, order becomes implicit.
- Mounting routes directly on the root app in `src/index.ts` — bypasses
  the domain boundary.
- Forgetting `name`/`seed` on shared plugins — hooks run twice on reload.
