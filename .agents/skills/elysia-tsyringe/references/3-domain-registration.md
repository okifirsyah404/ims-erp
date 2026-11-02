# 2.3 Domain container.ts Exports register<X>(container)

**Impact: CRITICAL**

## The Rule

Each domain has a `container.ts` exporting a `register<Domain>(container)`
function that registers the domain's repositories and service. The
composition root (`src/index.ts`) calls it after provider registration.

## Canonical Example (from this repo)

`apps/backend/src/app/location/container.ts`:

```typescript
export function registerLocation(container: DependencyContainer): void {
	container.register(PROVINCE_REPOSITORY_TOKEN, { useClass: ProvinceRepository });
	container.register(REGENCY_REPOSITORY_TOKEN, { useClass: RegencyRepository });
	container.register(DISTRICT_REPOSITORY_TOKEN, { useClass: DistrictRepository });
	container.register(VILLAGE_REPOSITORY_TOKEN, { useClass: VillageRepository });
	container.register(LOCATION_SERVICE_TOKEN, { useClass: LocationService });
}
```

`src/index.ts` — order matters:

```typescript
registerProvider(container);   // Drizzle, Redis connections first
registerLocation(container);   // then domain classes that inject them
```

## Why

- Provider registrations must precede domain registrations or repositories
  resolve `useValue` tokens that don't exist yet.
- One explicit call per domain keeps the boot sequence auditable in
  `src/index.ts` without grepping feature code.
- Registration (container.ts) stays separate from token definitions
  (contracts/), so services can import tokens without importing the
  container — no cycle.

## Where registration stops and mounting starts

`src/index.ts` **registers**; `src/app/app.ts` **mounts**. The split is
deliberate:

```typescript
// src/app/app.ts
export function createApp() {
  return new Elysia()
    .mount(auth.handler)
    .use(LocationController.plugin())
    /* ...every other controller */
}

// src/index.ts
registerProvider(container);
registerLocation(container);
/* ...every other register<Module> */
const bootstrap = new Elysia()
  .use(i18next(/* ... */))
  .use(wrap(pinoLogger))
  .use(createApp())
  .listen(appConfig.app.port);
```

`createApp()` is a **factory, not a module-level instance**. Controllers
resolve inside `plugin()`, so the graph must be populated first. An eager
`export const app` would build controllers at import time, and because
static imports are hoisted, correctness would then hinge on the import
order between `app.ts` and `index.ts` — invisible, and breakable by a
formatter or a reorder.

`app/app.ts` also owns the raw `auth.handler` mount and the `/docs`
OpenAPI plugin; request-scoped concerns (i18n, CORS, logger) stay in
`index.ts` and wrap the app before it mounts.

## Anti-patterns

- `container.register` calls scattered in feature files — import order
  silently decides what's registered.
- Registering domains before providers.
- A domain module that self-registers via import side effects.
- Calling `register<Module>` from `app/app.ts`, or `.use(Controller.plugin())`
  from `src/index.ts` — the split collapses and one file becomes unreadable.
