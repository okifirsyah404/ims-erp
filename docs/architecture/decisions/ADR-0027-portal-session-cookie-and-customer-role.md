# ADR-0027 - Customer Portal: Server-Held Session Cookie and the `customer` Role

- **Status:** accepted as proposed (2026-11-21, port plan decision D10,
  `docs/plan/port-portal-onto-main.md`); the owner gave the go for step P1 on
  2026-11-21. Implemented by ERP-0094. Originally written as ADR-0024 on the
  unmerged branch `feat/erp-0069-portal-session` (commit `8745d5a4`, ERP-0069);
  renumbered because ADR-0024..0026 are taken on `main`. Number checked against
  `origin/main`, every remote branch and the open pull requests (none) on
  2026-11-21. **Amended 2026-11-21** (owner request, same PR #139): the
  `customer` role check moved from the ERP to the customer portal - see
  decision 2.
- **Amends:** [ADR-0022](ADR-0022-customer-portal-api.md) decisions 1 and 3
  (how a portal caller is recognised and how the session travels). Everything
  else in ADR-0022 stands, as reshaped by ADR-0024 (the portal lives in the
  `customer` module at `/customers/portal/v1`; the login is a column set on
  `customer.customers`).
- **Context:** ADR-0022 handed the portal's server Better Auth's signed
  session cookie value as an `accessToken` in the sign-in body; the portal
  sent it back as `Authorization: Bearer`, and the guard accepted any login
  with an active portal login. The user asked (2026-11-19) for the portal to
  "use a session", limited to the **customer role** only, with the form
  validation done in the portal. The portal (`apps/web-customer-portal`) and
  the ERP API live on different origins, so a browser-held ERP cookie would
  need cross-site cookies and CORS.
- **Decision:**
  1. **The session is Better Auth's own session cookie, held by the portal's
     server.** `POST /customers/portal/v1/auth/login` and
     `/customers/portal/v1/auth/verify-email` answer `Set-Cookie` with the
     session cookie (Better Auth's name and attributes: HttpOnly,
     SameSite=Lax, Secure in production); the body carries only the user and
     `session.expiresAt`, never the token. The portal's server keeps the
     `name=value` pair in its server-side Astro session (the only cookie the
     browser sees is the portal's own session id) and sends it as the
     `Cookie` header on every `/customers/portal/v1` call. Logout answers a
     clearing `Set-Cookie`. The `Authorization: Bearer` transport is removed;
     the website's hand-off (`/api/connect/token`) carries the same
     `sessionCookie`.
  2. **Only the global `customer` role passes the portal guard.** Every
     portal login carries `customer` in `auth.users.role` (the admin plugin's
     comma-joined roles; `customer` is declared in
     `src/providers/better-auth/ac/admin-ac.ts`). The role is granted by the
     identity module (`ExportedUserService.grantCustomerRole`) when a person
     gets a login (staff invitation, owner invitation, verified sign-up); the
     default `user` role is replaced and any other role kept. Existing logins
     are backfilled by the data-only migration
     `20261121064831_erp0094_portal_customer_role` (every `customer.customers`
     row with `user_id` set and `deleted_at` null).
     **Who checks the role (amended 2026-11-21):** the ERP does not. It cannot
     tell which client sent a request (web admin, customer portal, website),
     so the guard, the sign-in, the code sign-in and the sign-up verification
     require only a live session **and** an active portal login
     (`portal_status = 'active'`, 401 otherwise), and return the user's global
     roles as `user.roles` (sign-in bodies and `/me`). The customer portal's
     server admits only `customer`: its sign-in actions end the fresh ERP
     session and answer like a wrong password for any other login, and its
     middleware drops a stored session whose user lacks the role
     (`apps/web-customer-portal/src/lib/portal-role.ts`). The original text
     had the ERP refuse a login without the role with 401.
  3. **The portal validates first, the ERP validates again.** The portal's
     Astro Actions are the user-facing validation; the ERP's zod schemas stay
     authoritative and are aligned with them (a new password is 12-128
     characters on both sides). ERP error messages are read from the
     envelope's `errors[].message`.
  4. **Documented request bodies.** The portal routes publish the zod schema
     each handler parses as the OpenAPI `requestBody` (`src/http/openapi.ts`,
     `requestBodyDoc`), plus a `summary`, without changing how requests are
     validated.
- **Consequences:**
  - Staff can never use the portal (no portal login at the ERP, no `customer`
    role at the portal) and a customer can never use the web admin (no
    organization membership, the login gate).
  - A login with an active portal login but without the `customer` role is
    accepted by the ERP's portal routes; only the portal refuses it. Such a
    login is created only by a manual role change, since the identity module
    grants the role with every portal login.
  - The ERP session never reaches a browser, so no cross-site cookie, CORS
    credential or bearer handling is needed; the ERP sees an ordinary Better
    Auth session (sliding expiry, revocation, `changePassword`).
  - A new password shorter than 12 characters is refused by the ERP too;
    existing passwords are untouched (sign-in accepts any stored password).
  - Revoking the login ends portal access at the next request. Revoking does
    not remove the `customer` role (the user row stays for history); a
    re-invited person keeps it.
