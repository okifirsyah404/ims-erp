# Customer portal: one owner, staff members, first sign-in (ERP-0115)

Status: **planned**. Follow-up of ERP-0114 (`/crm/customers` robustness,
2026-11-23). ERP-0114 changed the customer data model and the backend; the
customer portal web app (`apps/web-customer-portal`) and the portal-facing
enforcement were left out of scope by the owner and are planned here.

## What ERP-0114 already decided and shipped (backend)

Owner decisions, grill-me session 2026-11-23:

- **One Better Auth account = one `customer.customers` row.** Every person is
  created with an account: username `{name base}_{last 6 digits of the unix
  ms timestamp}` (always suffixed, base at most 23 characters, lower-case
  ASCII + `_`), default password `{username}12345678`, global role
  `customer`, `emailVerified = false`. The credentials are shown once to staff
  and emailed to the customer (`CredentialsEmail`, `email:customerCredentials.*`).
- **The email lives on the account** (`auth.users.email`); the
  `customer.customers.email` and `whatsapp` columns are gone (the phone, E.164,
  is also the WhatsApp number). Staff may correct an unverified email (the
  credentials are re-sent); the email is verified at the first portal sign-in
  and locked afterwards.
- **A company has exactly one owner and N staff.**
  `customer.companies.owner_customer_id` (intra-schema FK to
  `customer.customers`, unique among live rows) is the source of truth. Every
  other contact is staff: `portal_role` `approver | finance | viewer`. An
  individual owns their own account. `effectiveRole()`
  (`apps/backend/src/app/customer/utils/ownership.ts`) derives the role the
  portal guard sees; a stale stored `owner` reads as `viewer`.
- Staff move ownership (company edit form, or a portal invite with role
  `owner`); the previous owner becomes a viewer.
- Revoking a login keeps `user_id` (one account, one customer); re-inviting
  reactivates the same account.
- `customer.customers.portal_password_change_required` is set when the account
  is created with the default password and cleared by
  `POST /customers/portal/v1/account/password` (password change).
- The owner can never close their own login (`PortalLastOwnerError`, 409);
  ownership has to move first.

## Work planned here

1. **First sign-in must change the password (Q16).**
   - Backend: while `portal_password_change_required` is true, every portal
     route answers **403 `PORTAL_PASSWORD_CHANGE_REQUIRED`** except the session
     (`/me`), password change, logout and the sign-in itself. Implement in the
     `portal` guard / `PortalAuthService.resolve` context (carry the flag on
     `PortalContext`).
   - Sign-in response carries `passwordChangeRequired: boolean`.
   - Clear the flag on `/password-reset/confirm` as well (needs the user id of
     the reset token: resolve it before Better Auth consumes the token, or add
     an exported user-service method that returns it).
   - `web-customer-portal`: after sign-in, or on any 403 with that code,
     redirect to `/settings/password` in a "set a new password" mode (no other
     navigation until done); new password 12-128 characters
     (`portalNewPasswordSchema`).
2. **Sign-in with username (Q18).** The default password is derived from the
   username, so the portal sign-in field accepts an email **or** a username:
   backend `PortalAuthService.login` resolves a username to its user before
   `signIn` (keep the lockout keyed per identifier, same 401 for unknown /
   staff / wrong password), `portalLoginSchema` accepts either, and the portal
   login form labels the field "Email or username".
3. **Owner / staff UI in the portal.**
   - Members page: show the one owner (badge) and the staff list; the owner
     invites and removes staff (`approver | finance | viewer` only, as today).
   - Remove any UI that suggested several owners; explain that ownership moves
     through the supplier of the ERP (staff), or add a "transfer ownership"
     action if the owner asks for it (then: backend endpoint for the owner,
     confirmation by password).
   - "Delete my login" for the owner: explain the 409 (ownership first).
4. **Individual sign-up accounts get a username** (currently created without
   one): generate it on verification with the same rule, so every account can
   use the username sign-in.

## Done when

- Backend tests: the 403 gate (allowed routes listed), the flag cleared by
  change and reset, username sign-in incl. lockout and staff refusal.
- `web-customer-portal` tests for the redirect and the login field; manual
  walk-through: staff creates a customer in `/crm/customers`, the customer
  signs in with the emailed username and default password, is forced to
  change it, then reaches the dashboard.
- `docs/role-permission.md` regenerated if routes or guards change;
  `progress.md`, `backlog.md` and `features.md` updated in the same change.
