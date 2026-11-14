# 1.5 Response Envelope at the HTTP Layer Only

**Impact: MEDIUM-HIGH**

## The Rule

`TApiResponse<T>` / `TApiPaginatedResponse<T>` from `@ims-erp/common` are
built in controllers. Repositories return `TPaginationResult<T>`; the
controller maps `meta` into `pagination` and wraps the rows. Services
never construct envelope metadata.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts`:

```typescript
function okPaginated<T>(result: TPaginationResult<T>): TApiPaginatedResponse<T> {
	return {
		...buildMeta(200, 'OK'),
		pagination: result.meta,
		data: result.data,
	};
}
```

`buildMeta()` fills `requestId`, `status`, `message`, `timestamp` — all
HTTP-request-scoped values only the controller knows.

## Why

- `requestId` and HTTP status are transport concerns; a repository has no
  business generating them.
- One mapping point means one place to change the envelope (e.g. adding
  `traceId`) instead of every service method.
- Repositories stay transport-agnostic and reusable by non-HTTP callers.

## Anti-patterns

- A repository returning `{ meta: { requestId, ... }, data }`.
- Envelope built twice — once in service, re-wrapped in controller.
- 404 responses with a bare `{ message: '...' }` body instead of the
  envelope's `errors` array.
