# ADR-0024 - Customer Portal: Server-Held Session Cookie and the `customer` Role

- **Status:** proposed (2026-11-19). Records the user's decisions of
  2026-11-19 (ERP-0069); becomes accepted with the owner's review of the PR.
  Number checked against `origin/main`, every remote branch and the last 40
  PR heads on 2026-11-19 (highest in use: ADR-0023).
- **Amends:** [ADR-0022](ADR-0022-customer-portal-api.md) decisions 1 and 3
  (how a portal caller is recognised and how the session travels). Everything
  else in ADR-0022 stands.
- **Context:** ADR-0022 handed the portal's server Better Auth's signed
  session cookie value as an `accessToken` in the sign-in body; the portal
  sent it back as `Authorization: Bearer`, and the guard accepted any login
  with an active portal identity. The user asked (2026-11-19) for the portal
  to "use a session", limited to the **customer role** only, with the form
  validation done in the portal. The portal (`apps/web-customer-portal`,
  later `customer.entragate.com`) and the ERP API live on different
  origins, so a browser-held ERP cookie would need cross-site cookies and
  CORS.
- **Decision:**
  1. **The session is Better Auth's own session cookie, held by the portal's
     server.** `POST /portal/v1/auth/login` and `/verify-email` answer
     `Set-Cookie` with the session cookie (Better Auth's name and attributes:
     HttpOnly, SameSite=Lax, Secure in production); the body carries only the
     user and `session.expiresAt`, never the token. The portal's server keeps
     the `name=value` pair in its server-side Astro session (`eg_session`,
     the only cookie the browser sees) and sends it as the `Cookie` header on
     every `/portal/v1` call. Logout answers a clearing `Set-Cookie`. The
     `Authorization: Bearer` transport is removed; the website's hand-off
     (`/api/connect/token`) carries the same `sessionCookie`.
  2. **Only the global `customer` role passes the portal guard.** Every
     portal login carries `customer` in `auth.users.role` (the admin plugin's
     comma-joined roles, declared by ADR-0018). The role is granted when the
     identity is created (staff invitation or verified sign-up) and backfilled
     for existing identities by migration
     `20261119120000_erp0069_portal_customer_role` (data only). The guard, the
     sign-in and the sign-up verification all require the role **and** an
     active customer identity; either one alone answers 401.
  3. **The portal validates first, the ERP validates again.** The portal's
     Astro Actions (`astro/zod`) are the user-facing validation; the ERP's
     zod schemas stay authoritative and are aligned with them (a new password
     is 12-128 characters on both sides). ERP 400 messages are read from the
     envelope's `errors[].message`.
  4. **Documented request bodies.** The portal routes publish the zod schema
     each handler parses as the OpenAPI `requestBody` (`src/http/openapi.ts`,
     `requestBodyDoc`), plus a `summary`, without changing how requests are
     validated.
- **Consequences:**
  - Staff can never use the portal (no `customer` role) and a customer can
    never use the web admin (no organization membership, the login gate).
  - The ERP session never reaches a browser, so no cross-site cookie, CORS
    credential or bearer handling is needed; the ERP sees an ordinary Better
    Auth session (sliding expiry, revocation, `changePassword`).
  - A new password shorter than 12 characters is now refused by the ERP too;
    existing passwords are untouched (sign-in accepts any stored password).
  - Removing the `customer` role (or revoking the identity) ends portal
    access at the next request.
