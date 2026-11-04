> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Authentication & Authorization Module

## Purpose and boundary

Who you are and what you may do, both handled through Better Auth plus a
small ERP decision layer:

- **Authentication (Better Auth-owned):** identity, session, primary login
  flows. Better Auth 1.7.12 via `@thallesp/nestjs-better-auth` 2.8.0 is the
  single auth system — no second auth stack, ever. Owns tagging user identity
  to ERP actors; not role semantics.
- **Authorization (ERP decision layer):** role definitions, permission
  statements (`<resource>.<action>`), ownership checks, sync with the
  frontend. This is `src/core/` territory (module-agnostic), not a NestJS
  domain module. It owns **which role may do what**.

## Current state (audit, 2026-10-25)

**Auth: partially implemented. Authorization: absent core, design specified by tests.**

Authentication — working pieces:
- `src/providers/better-auth/auth.ts` — Better Auth instance.
- `src/providers/better-auth/auth-options.ts` — complete configuration:
  `emailAndPassword.enabled`, plugins `username`, `passkey`, `admin`,
  `organization`, `lastLoginMethod`, `multiSession`, `phoneNumber`,
  `emailOTP` (8-digit, rotate resend, 3 attempts, 5-min expiry, rate limit),
  `magicLink` (15-min expiry), `i18n` (en, id locales) — OTP/magic-link
  senders currently log to console (route through notification module later).
  `secondaryStorage` on Keyv/Redis (`better-auth:` prefix; `increment` via
  Redis client); session `expiresIn` 7 days (**seconds** unit).
- Database adapter: `@better-auth/drizzle-adapter/relations-v2`,
  `provider: 'pg'`, `schemaName: 'auth'`, `usePlural: true`.
- `AuthModule.forRootAsync` registered in `app.module.ts`.
- Frontend client: `apps/web-admin/src/lib/auth-client.ts` (base path
  `/api/auth`, credentials include, admin plugin enabled).

Authentication — gaps:
- `modules/auth` directory **does not exist**; pre-written specs
  `test/unit/modules/auth/{controllers,services}/*.spec.ts` fail on import.
- **Runtime unverified**: no real login/session/guard test has run. CORS /
  trusted-origins vs `VITE_API_URL` unconfigured in `main.ts`.

Authorization — state:
- `src/core/` does not exist.
- `src/providers/better-auth/role-permission.ts` exists but is **empty**
  (flagged by oxlint).
- Pre-written specs define the intended API (do not weaken them):
  - `test/unit/core/authorization/roles.spec.ts` expects `erpRoles` and
    `type ErpPermission` from `src/core/authorization/permissions.js`, plus
    an `AuthorizationService` with an `authorize(statement)` contract.
  - `test/unit/core/authorization/ownership.spec.ts` expects server-side
    ownership semantics (customer A vs customer B, investor A vs investor B).
- Permission resource/action catalog fully enumerated in
  `apps/web-admin/src/lib/permissions.ts` — backend must generate the
  identical set (sync test).

## Key files

- `src/providers/better-auth/{auth,auth-options,role-permission}.ts`
- `src/providers/keyv/keyv.ts` (secondary storage backend)
- `src/providers/drizzle/schemas/auth-schema.ts` (generated — never hand-edit)
- planned: `src/modules/auth/{controllers/auth.controller.ts,services/auth.service.ts}`
- planned: `src/core/authorization/{permissions.ts,authorization.service.ts}`
- sync target: `apps/web-admin/src/lib/permissions.ts`

## Data ownership

- `auth` schema tables (users, sessions, accounts, passkeys, OTP/magic-link,
  organizations, members, invitations). Timestamps bigint ms. Regeneration
  only via pinned `auth:generate` script. Role/membership read through Better
  Auth APIs — role-to-permission mapping lives in `role-permission.ts`
  (ADR-0001: membership semantics, not tenancy).

## Behavior targets (commercial scope: T02 role-based login and audit)

- Real login/session/logout proven at runtime; global auth guard denies
  unauthenticated requests to protected routes; public routes explicitly
  `@AllowAnonymous()`.
- Roles internal to v5.1: owner, finance, internal functional roles, customer
  portal user, investor portal user. Permission matrix:
  `../security-and-access.md`.
- Ownership rules: portal identities map to their own customer/investor rows;
  internal roles via the permission matrix; enforced server-side on every
  endpoint including exports/downloads.
- Login/logout and sensitive auth events produce audit trail entries.
- Rate limiting on auth endpoints (`@nestjs/throttler` installed, unused).
- OTP/magic-link senders route through the notification module (sandboxed
  until provider approval per v5.1 condition gates).
- Tenant dimension: none (one business entity — plan v5.1, ADR-0001).

## Dependencies and rules

- Depends on: infrastructure (config, drizzle, keyv), notification (OTP
  flows). The authorization layer is importable by any domain service — never
  circular-import domains; it reads no ERP tables except identity links (via
  contracts if needed).
- Cache discipline: authorization checks must not depend on permission caches
  without authenticated invalidation — prefer in-process evaluation; if
  caching is added, scope keys to role/version and invalidate on role change.
- Frontend contract: keep `auth-client.ts` and `permissions.ts` in step with
  server changes.

## Tests

- Existing 4 failing pre-written suites are the design contract:
  `modules/auth` controller/service (2) and `core/authorization` roles +
  ownership (2). Tasks **ERP-0002 / ERP-0003** implement to green without
  weakening covered assertions.
- Required additions (phase-2 exit): real-session e2e — login → session
  fetch → guard-denied anonymous request → logout; role/permission matrix
  tests; backend permission set equals `web-admin/lib/permissions.ts`
  keys/actions.
