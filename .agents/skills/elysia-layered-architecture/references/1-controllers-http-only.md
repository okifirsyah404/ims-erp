# 1.1 Controllers Own HTTP Only

**Impact: CRITICAL**

## The Rule

Controllers parse input, build the response envelope, and map statuses.
They never import Drizzle schemas/tables and never contain business logic.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts` imports
only: Elysia, zod contracts from `../contracts/`, DI tokens, the service,
and envelope types from `@ims-erp/common`:

```typescript
.get(
	'/provinces',
	async ({ query }) =>
		okPaginated(
			await locationService.paginateProvinces(
				provinceQuerySchema.parse(query),
			),
		),
)
.get('/provinces/:id', async ({ params, status }) => {
	const row = await locationService.getProvince(params.id);
	if (!row) {
		return status(404, errorEnvelope(404, 'Not found', [
			{ message: 'Province not found' },
		]));
	}
	return ok(row);
})
```

## Why

- Controllers stay trivially reviewable: parse → delegate → envelope.
- Business rules in controllers cannot be reused by other transports
  (queues, cron) — the service is the reusable unit.
- Controller tests cover status/envelope mapping only; service tests cover
  rules. Mixed layers make both kinds of test brittle.

## Route Ordering and Macro Typing (from the user module)

**Self routes precede param routes.** `GET /me` must be declared
**before** `GET /:userId`, or the router captures `me` as the `:userId`
parameter. Identity comes from the guard-resolved session, never client
input:

```typescript
// apps/backend/src/app/user/controllers/user.controller.ts — the pattern
.get(
	'/me', // declared BEFORE '/:userId'
	async ({ erp, status }) => {
		const profile = await userService.getUser(erp.session.user.id);
		// ...404 envelope when absent
	},
	{ erp: { permission: [] } },
)
.get('/:userId', /* admin-scoped read */)
```

Self-scoped reads need no permission gate; broader reads/mutations on the
same resource use `erp: { policy: ... }` with a server-side check that
reads the role from the guard session (`requireGlobalAdmin` in the user
controller — never from client input; Better Auth re-checks inside its
own admin endpoints).

**Empty macro options break handler typing.** With `erp: {}`, Elysia
drops the macro's resolved `erp` context from the handler's inferred type
— destructuring `erp` fails typecheck. Pass a non-empty option object
(`{ permission: [] }`) or `policy` so the macro contributes its resolve
type.

## Anti-patterns

- `import { province } from '@drizzle/schemas/location.schema'` in a
  controller — data layer leaked into HTTP.
- Validation beyond `.parse()` (e.g. "does this province exist?" checks)
  in a controller — belongs in the service.
- Declaring `/:id` routes before literal segments (`/me`, `/stats`) —
  the literals are never reached.
- `erp: {}` while the handler destructures `erp` — silent loss of the
  resolved context in the type system.
