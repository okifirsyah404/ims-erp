# 2.7 Plugin-Local onError Maps Validation to the Envelope

**Impact: MEDIUM**

## The Rule

Each plugin registers `.onError({ as: 'local' }, ...)` mapping Elysia
`VALIDATION` codes and thrown `ZodError`s to the 400 response envelope
(`TApiResponse` with an `errors` array). Never shadow the `error` context
parameter with a local helper.

## Canonical Example (from this repo)

`apps/backend/src/app/location/controllers/location.controller.ts`:

```typescript
.onError({ as: 'local' }, ({ code, error, set }) => {
	if (code === 'VALIDATION') {
		set.status = 400;
		return errorEnvelope(400, 'Validation failed', [
			{ field: error.value ? String(error.value) : null, message: error.message },
		]);
	}
	if (code === 'PARSE' || error instanceof ZodError) {
		set.status = 400;
		return errorEnvelope(400, 'Validation failed', [
			{ field: null, message: String(error) },
		]);
	}
	return undefined;
})
```

Note `errorEnvelope` — the helper was originally named `error`, which
shadowed the `error` context parameter and broke the handler's typing.

## Why

- `as: 'local'` scopes the hook to this plugin's routes only — other
  domains keep their own mapping.
- Zod throws inside handlers surface as `UNKNOWN` code; the
  `instanceof ZodError` branch catches them and still returns 400.
- Unmapped validation failures become 500s, hiding a client mistake.

## Anti-patterns

- Local helpers named `error`, `status`, or `set` inside `plugin()`.
- Global `.onError` on the root app for domain-specific envelope shapes.
- Using `scope: 'local'` — the option is `as: 'local'` (compile error).
