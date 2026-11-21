# ADR-0027 - Invitation-only sign-in: Google never signs up, only active accounts get a session

- **Status:** proposed (2026-11-21, ERP-0107).
- **Amends:** ADR-0017 §8 and ADR-0018 §5 (login gate): the gate now also
  requires an active account.
- **Numbering note:** `docs/plan/port-portal-onto-main.md` mentions a
  *proposed* ADR-0027/0028 for the portal port; neither file exists. If that
  plan is adopted it takes the next free numbers.

## Context

The ERP is invitation-only: an administrator invites a person, the
invitation pre-creates an `auth.users` row (`status: 'pending'`,
`emailVerified: true`), and the claim sets credentials and `status: 'active'`
before it opens the first session.

Before this record, "Sign in with Google" broke that model in three ways:

1. An unknown Google email **created** a new `auth.users` row (Better Auth's
   default social sign-up). The login gate then refused the session, but the
   orphan user stayed.
2. A **pending** invitee could skip the claim: their row has
   `emailVerified: true`, so Better Auth implicitly linked the Google account,
   and an invited application admin passed the role-only gate.
3. Nothing on the session path read `status` or `deletedAt`. A
   **deactivated** user was only stopped by the session revocation at
   deactivation time; a later password or Google sign-in succeeded, despite
   the `auth.options.ts` comment saying "login blocked".

Refusals also surfaced badly: an uncoded `APIError` from a hook made the
OAuth callback answer with raw JSON on the API origin, and the web Google
callback was a relative URL, so even success landed on the API host.

## Decision

1. **Google cannot sign up.** `socialProviders.google.disableSignUp: true`
   (`options/social-providers.auth.ts`). An unknown email ends at the error
   callback with `error=signup_disabled`; no row is written.
2. **Only active accounts get a web-admin session.** The login gate
   (`ac/login-gate.ts` `webAdminDenial`, applied in `session.create.before`
   and in the per-request `isWebAdminSessionAllowed`) refuses
   `status <> 'active'` or `deleted_at IS NOT NULL` with code
   `ACCOUNT_NOT_ACTIVE`, before the role rule (`WEB_ADMIN_ACCESS_DENIED`).
   This covers every sign-in method: password, username, Google, passkey,
   magic link, impersonation. A `null` status counts as active (legacy rows).
   The customer-portal sign-in keeps its own exception (ADR-0022).
3. **No social link on an inactive account.**
   `databaseHooks.account.create.before` (`options/account-link.auth.ts`)
   refuses a non-`credential` account for a pending, deactivated, deleted or
   missing owner with `ACCOUNT_NOT_ACTIVE`. `credential` is exempt because
   the claim writes the password while the row is still pending.
4. **Coded, translated refusals.** Gate errors carry `code` and an
   `api`-namespace message (`auth.accountNotActive`,
   `auth.webAdminAccessDenied`) in the request language. Better Auth's OAuth
   callback forwards the code as `?error=<code>`.
5. **Web `/login`.** Google uses absolute same-origin `callbackURL` and
   `errorCallbackURL` (`/login?redirect=…`); `/login` maps
   `signup_disabled`, `ACCOUNT_NOT_ACTIVE`, `WEB_ADMIN_ACCESS_DENIED`,
   `account_not_linked`, `BANNED_USER` (else a generic line) to an `auth`
   message and clears the parameter.

Unchanged: Better Auth's own linking rules (`requireLocalEmailVerified`
default true — an active account with an unverified local email gets
`account_not_linked` and must sign in with the password and link Google on
`/accounts`), same-email linking only, and the ban mechanism.

## Consequences

- An invitee must claim the invitation before any sign-in, Google included.
- Deactivation now blocks sign-in for real; restore (`status: 'active'`) is
  the only way back. A restored soft-deleted user is `pending` and must claim
  again (existing restore behaviour).
- Existing sessions of a user who becomes inactive are refused on their next
  request by the per-request gate.
- Verified 2026-11-21 (see `docs/plan/progress.md`, ERP-0107): unit tests
  (`login-gate.test.ts`, `google-login-hardening.auth.test.ts`,
  web-admin `login-error.test.ts`) and an in-process run of Better Auth's
  OAuth user-info step with the configured Google provider against the dev
  database, 14/14. A real Google round trip has not been run.
