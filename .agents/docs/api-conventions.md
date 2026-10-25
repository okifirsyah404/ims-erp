# API Conventions

Conventions for backend HTTP endpoints. The one truly implemented endpoint
surface (user repository/test specs) defines the envelope; follow it exactly.

## Routing / route shape

- NestJS controllers per domain module, Fastify adapter.
- Resource-style paths per domain (`@Controller('customer')`,
  `@Controller('user')` — pluralization cleanup decisions land with each
  module's slice; keep existing verbs stable so tests/e2e don't churn).
- Swagger setup exists but with placeholder metadata ("Cats example") —
  replace titles/tags as modules gain real endpoints.
- Auth: `@thallesp/nestjs-better-auth` provides the authenticated context; a
  global auth guard with `@AllowAnonymous()` for public routes (login, health)
  is the target pattern (see `nestjs-better-auth` skill).

## Validation

- Request bodies/params validated with zod at the boundary (class-validator /
  class-transformer are installed but the codebase's established validation is
  zod — config schema, planned DTO validation). Parse → typed DTO → service.
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
  self-consistent with `data` (established in `user.repository.ts`).
- Single-resource endpoints return the row object; `204`/`200` semantics per
  mutation kind.

## Error contract

- Transport/known errors: NestJS HTTP exceptions (400 validation,
  401 unauthenticated, 403 unauthorized, 404 absent-or-soft-deleted,
  409 unique-conflict race (`23505`), 422 for state-rule violations when 409
  is wrong).
- Internal failures surface as 500 without leaking internals; no
  connection strings, no stack traces, no raw driver messages to clients.
- Unique-violation races are translated once, at the service layer, not in
  repositories or controllers.

## Permissions and ownership

- Every endpoint authorizes server-side: role permission
  (`<resource>.<action>` from `permissions.ts` — must stay in sync with
  `apps/web-admin/src/lib/permissions.ts`) and record ownership where a
  portal identity applies.
- Ownership examples pinned for tests: customer users read only their own
  records, investor users read only their own capital/distributions, internal
  roles per the role-permission matrix in `security-and-access.md`.
- Exports (CSV/PDF) go through the same checks as JSON endpoints.
- Mutations of sensitive resources write `erp.audit_logs` rows
  (actor id/role, action, resource, metadata) — credentials and unnecessary
  personal data redacted.

## Cache-aware reads

- id-targeted reads may serve from cache; list endpoints must not (established
  rule in `user.repository.ts`). Keys: `<resource>:<id>` under the module
  namespace; organization/scoping prefix when authorization boundary applies.
- Writers evict after commit — even when the write matched nothing.
