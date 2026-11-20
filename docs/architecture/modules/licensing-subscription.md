# Licensing & Subscription Module (M03)

Code: `apps/backend/src/app/licensing/` (schema `licensing`, company-wide),
web `apps/web-admin/src/routes/_authed/subscription/`. Status: stage 1
(register, T09) and stage 2 (license API, T23) **implemented 2026-11-06, not
yet accepted by the owner**; pilot integration (T24) **blocked** until the
pilot application's source is available. Evidence: `docs/plan/progress.md`.

> The 2026-10-25 audit text that stood here described the deleted NestJS
> backend; it is replaced by this file.

## Purpose and boundary

Which customer licenses which application, for how long, with which keys;
and the machine API the company's own application calls to check and
activate its licenses. Owner decisions (2026-11-06): both third-party
(vendor keys typed in) and own applications (keys generated); billing stays
in the sales flow (SPH → SO → invoice); reminders are the due list and the
dashboard; grace period 7 days; a draft renewal activates by itself once its
sales order is paid in full. Out of scope (v5.1): offline licensing,
anti-piracy beyond an instance id, usage metering, all applications.

## Data (see `docs/database/docs.dbml`, MODULE Licensing)

| Table | Role |
|---|---|
| `licensable_applications` | applications licensed (`third_party` / `own`) |
| `license_contracts` | customer, application, period, value, sales order, status, renewal link |
| `license_keys` | keys of a contract, seats (`max_activations`), expiry |
| `license_activations` | seats taken by installations (`instance_id`) |
| `license_events` | append-only log of API calls and staff overrides |
| `application_api_keys` | machine keys of own applications (secret hashed in `auth.apikeys`, config `licensing`, prefix `elk_`) |

Status `draft → active ⇄ suspended → terminated`; `active → renewed` when
its renewal activates (keys and seats move to the renewal). "Due", "grace"
and "expired" are derived from the effective end date (the earlier of the
contract end and the key expiry), never stored; no background job.

## Boundaries

- CRM: `CustomerService.getActiveCustomer`. Sales:
  `SalesFulfilmentService.getLiveOrder`. Finance:
  `InvoiceLookupService.paidTotal` (receipts are verified when recorded;
  reversed receipts are already taken out). Organization: numbering
  (`license_contract`, `LIC`), `listMembers` (names of who issued and who
  revoked each machine key).
- Better Auth API keys are reached only through
  `adapters/better-auth-api-keys.ts`. **Since 2026-11-15 (PR #100 review)**
  a key is issued and revoked **as the acting member**, not as the
  organization owner:
  - Better Auth checks that member's organization `apiKey` statement,
    granted only to roles that hold `license:manage_api` (owner, sales
    manager; a permission-matrix test keeps the two together).
  - The key stays organization-owned (`reference_id` = organization), so it
    survives the issuer leaving.
  - The issuer is stored in the key's metadata (`issuedBy`) and on the
    licensing row (`created_by` / `revoked_by`). The API keys screen shows
    "Issued by" / "Revoked by".
- The API key plugin's own HTTP routes (`/api/auth/api-key/create|get|list|update|delete|delete-all-expired-api-keys`)
  are closed with Better Auth `disabledPaths`. Keys are managed only through
  the ERP endpoints and `scripts/create-website-api-key.ts`, which call
  `auth.api` server-side and are not affected. Before this, the owner could
  mint keys of any config directly over HTTP; with the `apiKey` grant the
  sales manager could have too.
- Paid renewals are checked when the register is read (list, detail,
  summary) and when a key is validated, activated or released. Activation is
  guarded on `draft`, so one payment renews once.

## Permissions

`license:read | create | activate | extend | revoke | read_key | manage_api`.
Owner and sales manager: all (plus Better Auth `apiKey: create, read, update`
for issuing and revoking machine keys as themselves). Sales: read, create, extend, read_key.
Customer service: read, read_key. Finance, admin, auditor: read. Keys are
masked (last 4) without `read_key`.

## License API — integration note for the pilot application

Base URL: the ERP backend, prefix `/projects/api/v1/licenses`. Server-to-server or from
the installed application; every request sends
`Authorization: Bearer elk_…` (issued under **Subscription & Licensing →
API Keys**, shown once). Rate limit: 120 calls per minute per key (429). A
key only reaches licenses of its own application; others look unknown.
JSON bodies; responses use the ERP envelope `{ requestId, status, message,
timestamp, data }`, plus `errors[]` on an error (corrected 2026-11-14).

The published reference for application teams is the guide
`docs/architecture/modules/licensing-integration.md` plus the spec
`docs/architecture/api/licensing.yaml` (both moved there when the separate docs site
was removed in favour of `@elysia/openapi`, which serves the Better Auth schema
at `/docs` — not these licensing routes).

| Call | Body | Answer |
|---|---|---|
| `POST /validate` | `{ licenseKey, instanceId? }` | 200 always: `data.valid`, `data.status` |
| `POST /activate` | `{ licenseKey, instanceId, deviceName? }` | 200 with the validation; 403 refused, 404 unknown, 409 no seat left |
| `POST /deactivate` | `{ licenseKey, instanceId }` | 200 `{ released: true }`; 404 not activated / unknown |

`status`: `ok`; `grace` (still valid — show a warning; `graceEndsOn`);
`expired`, `not_started`, `suspended`, `terminated`, `revoked`, `unknown`,
`not_activated` (an `instanceId` was sent but holds no seat). The answer also
carries `endsOn`, `daysLeft`, `maxActivations`, the application, the
customer name and the seat (`activation`). `activate` is idempotent per
`instanceId`.

Suggested client behaviour: activate once at install time with a stable
`instanceId`; validate on start-up and then daily; keep running while
`valid` is true and warn during `grace`; on `valid: false` stop the licensed
features; deactivate when the installation is removed. Bad API key → 401.

## Tests

`apps/backend/test/unit/licensing.service.test.ts` (register, renewal, paid
auto-renewal idempotency, keys, masking, overrides logged) and
`license-api.service.test.ts` (state at each boundary: end date, end + 7
days; 401 / 429; foreign keys unknown; seats; refusals; API keys). Browser
e2e 2026-11-06 recorded in `progress.md`. Open: real-PG integration tests;
the pilot application's own contract tests (T24).
