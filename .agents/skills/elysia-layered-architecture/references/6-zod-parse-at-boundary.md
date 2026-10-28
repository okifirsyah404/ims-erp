# 1.6 Zod Parse at the Boundary

**Impact: MEDIUM**

## The Rule

Raw query/body objects are parsed with zod in the controller
(`schema.parse(query)`) before any service call. Services and repositories
receive parsed, typed values only — never `Record<string, unknown>`.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts` with
schemas from `contracts/location.contract.ts`:

```typescript
export const regencyQuerySchema = paginationQuerySchema.extend({
	code: z.string().min(1).optional(),
	name: z.string().min(1).optional(),
	provinceId: z.uuid().optional(),
});

// controller
regencyQuerySchema.parse(query) // → TRegencyQuery, coerced page/limit
```

`paginationQuerySchema` coerces and caps: `page` ≥ 1 (default 1), `limit`
1–100 (default 20) — the cap lives in the contract, not the route.

## Why

- Coercion (`'3'` → `3` for query strings) must happen exactly once,
  before typed code sees the value.
- Zod failures thrown in the controller are caught by the plugin-local
  error handler and mapped to a 400 envelope; failures deeper in the stack
  surface as 500s.
- Parsed types (`z.infer`) document the actual input contract per endpoint.

## Anti-patterns

- Passing `query` (an untyped record) straight into a service.
- Re-validating the same fields in the repository "for safety".
- Defaults and caps declared in route handlers instead of the contract.
