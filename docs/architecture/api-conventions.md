# API Conventions

Conventions for backend HTTP endpoints (`apps/backend`). Envelope
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
- **Repository convention (one page, one method, one helper).** A repository
  method that answers one filtered page is named `paginate`, or
  `paginate<Thing>` when one repository serves several lists
  (`paginateMembers`, `paginateReceipts`, `paginateIncoming`,
  `paginateTaxTypes`). It takes **one request object** — `TPaginationRequest &
  { ...filters }` with the tenant inside it — never `(organizationId, filters,
  pagination)` positionally, and it returns `TPaginationResult<T>` built by
  `paginationResult(request, total, data)` from
  `apps/backend/src/utils/pagination.util.ts`. `totalPages` is
  `Math.ceil(total / limit)`, so an empty result set reports **0** pages;
  callers clamp (`useClampPage` in web-admin). A `paginate` that returns bare
  rows plus a separate `count()` is the defect this convention removes: the
  service would have to hand-build `meta` and the two could disagree.
- Single-resource endpoints return the row object; `204`/`200` semantics per
  mutation kind.
- Public (unauthenticated-session) catalog lists follow the same contract: the
  `@ims-erp/common` `TPaginationMeta` (`{ page, limit, total, totalPages }`)
  with the query parameter `limit` (not `pageSize`).
  `GET /inventory/public/v1/catalog/products` answers `okPaginated(...)`
  (rows in `data`, meta in `pagination`).

## URL layout (ADR-0024)

Each module mounts under its own prefix; there are **no URL aliases** (removed
2026-11-20). Prefixes that are easy to get wrong:

| Surface | Path |
|---|---|
| Inbound provider webhooks (`webhook` module) | `/webhooks/{xendit,singapay,whatsapp}`: 200 for `accepted\|duplicate\|ignored`, 401 `rejected`, 404 unknown provider |
| Machine license API | `/projects/api/v1/licenses/*` |
| Website forms (API key `Authorization: Bearer ewk_...`) | `/projects/public/v1/*` |
| Public catalog | `/inventory/public/v1/catalog/*` |
| Public quotation render | `/sales/public/v1/render/quotations` |
| Public document shares | `/documents/public/v1/shares/:token` |
| Customer portal | `/customers/portal/v1/*` |
| Payments, gateway checkouts, gateway admin | `/payments`, `/payments/checkouts/*`, `/admin/payments/gateways` |
| Other modules | `/inventory`, `/sales`, `/customers`, `/suppliers`, `/procurement`, `/finance`, `/taxes`, `/projects`, `/tickets`, `/human-resources`, `/documents`, `/companies`, `/notifications` |

Known inconsistency: a webhook reply with outcome `rejected` or `unknown` sets
the HTTP status (401/404) but its body envelope still says `status: 200`
(observed in the 2026-11-20 live smoke test, not yet fixed).

## Error contract

- Transport/known errors: plain HTTP status mapping (400 validation,
  401 unauthenticated, 403 unauthorized, 404 absent-or-soft-deleted,
  409 unique-conflict race (`23505`), 422 for state-rule violations when 409
  is wrong).
- **Validation errors list every problem** (P7-6, TF-1): a 400 carries one
  `errors[]` entry per issue, each `{ field, key, params?, message }`.
  `field` is the dot path (`name`, `lines.0.quantity`; `null` for the whole
  body), `key` is a shared key from `@ims-erp/common` `forms/form-error.ts`
  (`required`, `invalidFormat`, `min`, `max`, `minLength`, `maxLength`,
  `notNegative`, `notPast`, `dateOrder`, `taken`, `exceedsRemaining`,
  `emptyTable`, `contactRequired`, `unknownField`), and `message` is the
  `api:validation.<key>` text in the request language (never Zod's English).
  Zod routes are re-parsed to get every issue; TypeBox routes use
  `ValidationError.all`; a `ZodError` thrown by a handler is mapped the same
  way. Custom rules report a key with `formRule(key, path)`. Web forms re-word
  the key with their own field label (`common:formError.<key>`).
- Internal failures surface as 500 without leaking internals; no
  connection strings, no stack traces, no raw driver messages to clients.
  The 500 message carries a reference (RF-27): `errorRef(requestId)` (first
  eight hex digits of the envelope `requestId`, upper-case); the server logs
  the full `requestId` and `ref` with the error. Field errors carry no
  reference.
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

## Notification endpoints

Notification is app-scope (`ADR-0016`): the list is per user, **not** per
organization. These routes ride the session guard only — no `erp` macro, no
`x-organization-id`, because a notification must be readable from every
organization the user belongs to.

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | paginated, newest first, filters on `user_id` only |
| GET | `/notifications/unread-count` | `{ count }`, cheap enough for the badge |
| PATCH | `/notifications/:id/read` | 404 when the row belongs to another user |
| POST | `/notifications/read-all` | marks every unread row of the caller |

A notification id belonging to another user returns **404**, never 403: probing
must not reveal existence. Read state is the only mutable field.

## Realtime socket

One WebSocket for the whole application: `GET /ws` (upgrade). Authentication is
the Better Auth session cookie presented with the upgrade request; without a
session the upgrade is rejected with the standard 401 envelope and no message
handling runs. Implementation: `apps/backend/src/providers/realtime/`.

Every frame is the same envelope, whatever the feature:

```jsonc
{ "type": "notification.created", "status": "success", "sentAt": 1735689600000, "data": { /* event payload */ } }
```

- `type` names the event; the prefix is the feature (`notification.`,
  `chat.`). A new realtime feature adds a type, never a second socket.
- `status` is the delivery result of the frame (`success` | `error`).
- `sentAt` is unix milliseconds, matching the database convention.
- `data.status` carries the domain status (`sent`, `read`), which is a
  different thing from the frame's `status`.
- REST remains the source of truth: the socket only accelerates. A client that
  was offline catches up from `GET /notifications` on reconnect.
