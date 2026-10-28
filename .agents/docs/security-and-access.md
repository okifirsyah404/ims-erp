# Security and Access

Auth, roles/permissions, portals, secrets, and audit. The backend is
authoritative; every frontend check is UX only.

## Session and auth stack

- Better Auth 1.7.12 via `@thallesp/nestjs-better-auth` 2.8.0 on Fastify with
  `bodyParser: false`. Sessions: cookies with `credentials: 'include'`,
  frontend base path `/api/auth`, `VITE_API_URL` configurable.
- Plugins in use: `admin`, `organization`, `username`, `passkey`,
  `emailOTP` (8-digit, rotate-on-resend, 3 attempts, 5-minute expiry,
  rate-limited), `magicLink` (15-minute expiry), `lastLoginMethod`,
  `multiSession`, `phoneNumber`, `i18n` (en, id).
- Secondary storage on Keyv/Redis (`better-auth:` key prefix; `increment` uses
  Redis client). Session `expiresIn` is in **seconds** (7 days) — do not
  confuse with CacheModule TTL (milliseconds).
- Runtime verification still outstanding (Phase 2 exit criteria): real login,
  session retrieval through the guard, cookie behavior, CORS/trusted origins
  vs `VITE_API_URL`, and webhook-style raw-body paths. Compilation success is
  not proof.

## Role → resource → action matrix

Canonical target (from `apps/web-admin/src/lib/permissions.ts`, `format
<resource>.<action>`; backend `src/core/authorization/permissions.ts` must
generate the identical set):

| Resource | Actions |
|---|---|
| dashboard | view |
| crm.lead | view, create, update, delete |
| sales.quote / sales.order / sales.invoice | view, create, (approve/update per resource) |
| license | view, create, activate, renew, suspend |
| inventory.stock | view, receive, adjust |
| purchasing.purchase | view, create, approve |
| assets | view, create, update, delete |
| projects.project | view, create, update |
| support.ticket | view, create, update, close |
| hr.employee / hr.attendance / payroll | view/create/update; view/create/approve; view/prepare/approve/post |
| finance.account / finance.transaction / finance.reconciliation / finance.report / finance.period | view; view/create/update/reverse; execute; view; close |
| tax.configuration / tax.report | view, update; view |
| investor / investor.distribution / investor.payment | view/create/update; approve; view |
| reports | view, export |
| users / roles | view, create, update, (disable / delete) |
| permissions, audit | view |
| customer.portal / investor.portal | view |

Role definitions (`erpRoles` in the planned `permissions.ts`) were specified
by pre-written specs in the deleted backend-nest tree
(`apps/backend/test/unit/core/authorization/`) — the role/ownership matrix in
this document is the surviving design contract; port those specs to
backend-elysia when the authorization core lands.

## Ownership (row-level) rules

- Customer portal users: read/write scoped to records linked to their own
  customer identity; no visibility into other customers.
- Investor portal users: read-only own capital records, approved
  distributions, payment history.
- Internal roles: governed by the permission matrix; record-level ownership
  applies where a employee/salesperson link exists (enforced server-side on
  every endpoint incl. exports).
- Data isolation boundary: one company (ADR-0001). Internal organizations do
  not create data partitions; they gate membership/roles only.

## Secrets policy

- Secrets live only in server env/config (`APP_SECRET`, `POSTGRES_*`,
  `REDIS_*`, `S3_*`, gateway keys when introduced). Never in `@ims-erp/common`,
  never in frontend bundles, never in public API responses or error payloads.
- `.env` must stay out of commits (verify `.gitignore` before committing).
- Never print secret values in logs, docs, or agent reports; reference variable
  names only.
- DB URLs: only connect to known disposable/dev endpoints; destructive
  operations require explicit confirmation of the target DB.

## Audit rules

- Sensitive mutations (payments, payroll, distributions, period close, license
  state changes, user/permission changes, master-data structural changes)
  append rows to `erp.audit_logs`: actor id + role, action, resource
  type + id, metadata (redacted), ip, user agent.
- Audit reads are permission-gated (`audit.view`).
- Log hygiene: no credentials, tokens, password hashes, or full personal data
  in any log stream.

## Hardening TODOs (track in backlog)

- Rate limiting on auth endpoints (`@nestjs/throttler` is installed but
  unused) — Phase 2.
- CORS/trusted-origins configuration review for the Fastify app.
- Replace placeholder Swagger metadata before exposing docs publicly.
- Restrict supplier/employee bank-detail reads (permission-scoped, masked in
  list responses).
