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

## Anti-patterns

- `import { province } from '@drizzle/schemas/location.schema'` in a
  controller — data layer leaked into HTTP.
- Validation beyond `.parse()` (e.g. "does this province exist?" checks)
  in a controller — belongs in the service.
