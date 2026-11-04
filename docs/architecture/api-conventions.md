# API Conventions

Conventions for backend HTTP endpoints (`apps/backend-elysia`). Envelope
conventions carry over from the prior backend implementation.

## Routing / route shape

- Elysia routes per domain (`src/app/<domain>/routes|controllers`), Bun runtime.
- Resource-style paths per domain; keep existing verbs stable so tests/e2e
  don't churn.
- Auth: Better Auth session context is resolved in the route handler; the
  Better Auth instance lives in `src/providers/better-auth/` (options,
  plugins, openapi extractor).

## Validation

- Request bodies/params validated with zod at the boundary (Elysia route
  schemas or explicit zod parse). Parse → typed input → service.
- Never trust raw JSON: parse at the boundary; then the service refines.
- Pagination requests: `page` (1-based) + `limit` plus the filters the
  repository actually supports. Document supported filters/sorts per endpoint;
  do not claim unsupported capabilities.

## Response envelope

- List endpoints return `TPaginationResult<T>` from `@ims-erp/common`:

```jsonc
{
  "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 },
  "data": [ /* T */ ]
}
```

- `total` counts matching alive rows before the page is cut — the envelope is
  self-consistent with `data`.
- Single-resource endpoints return the row object; `204`/`200` semantics per
  mutation kind.

## Error contract

- Transport/known errors: plain HTTP status mapping (400 validation,
  401 unauthenticated, 403 unauthorized, 404 absent-or-soft-deleted,
  409 unique-conflict race (`23505`), 422 for state-rule violations when 409
  is wrong).
- Internal failures surface as 500 without leaking internals; no
  connection strings, no stack traces, no raw driver messages to clients.
- Unique-violation races are translated once, at the service layer, not in
  repositories or controllers.

## Permissions and ownership

- Every endpoint authorizes server-side: role permission
  (`<resource>.<action>` from the backend permission source — must stay in
  sync with `apps/web-admin/src/lib/permissions.ts`) and record ownership
  where a portal identity applies.
- Ownership examples pinned for tests: customer users read only their own
  records, investor users read only their own capital/distributions, internal
  roles per the role-permission matrix in `security-and-access.md`.
- Exports (CSV/PDF) go through the same checks as JSON endpoints.
- Mutations of sensitive resources write audit-log rows
  (actor id/role, action, resource, metadata) — credentials and unnecessary
  personal data redacted.

## Cache-aware reads

- id-targeted reads may serve from cache; list endpoints must not (established
  rule from the prior backend). Keys: `<resource>:<id>` under the domain
  namespace; organization/scoping prefix when the authorization boundary
  applies.
- Writers evict after commit — even when the write matched nothing.
