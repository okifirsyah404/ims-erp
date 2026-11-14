# 2.2 Resolve Only Inside plugin()

**Impact: CRITICAL**

## The Rule

`container.resolve` appears exactly once per domain — inside the
`plugin()` factory, at build time. Route handlers close over the resolved
service. Never per-request, never inside a service or repository, never
`new Service()`.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts`:

```typescript
static plugin() {
	// Resolved once when the plugin is built, closed over below.
	const locationService = container.resolve<LocationService>(
		LOCATION_SERVICE_TOKEN,
	);

	return new Elysia({ prefix: '/locations', name: 'location' })
		.get('/provinces', async ({ query }) =>
			okPaginated(await locationService.paginateProvinces(/* ... */)),
		);
}
```

## Why

- Per-route resolution re-walks the dependency graph on every request for
  transient registrations.
- `new Service()` inside a route bypasses injection of the service's own
  dependencies — they arrive `undefined` at first use, deep in a request.
- Build-time resolution makes wiring failures fail at boot, not per-request.

## Anti-patterns

- `container.resolve(...)` inside a route handler closure.
- `new LocationService(new ProvinceRepository(...))` — hand-built graph.
- `container.resolve` inside a repository or another service —
  dependencies arrive via constructor injection only (see `tsyringe` skill 3.1).
