> Updated 2026-11-20 (ADR-0024): the portal API now lives in the `customer` module at `/customers/portal/v1` (was `/portal/v1`); tickets are owned by `ticket`, warranties by `project`.
>
> Updated 2026-11-21 (ERP-0094, [ADR-0027](../decisions/ADR-0027-portal-session-cookie-and-customer-role.md)): the session is Better Auth's own session cookie held by the portal's server (`Set-Cookie` on sign-in, `Cookie` on every call, no bearer token). Only a login with the global `customer` role may use the portal: the ERP returns `user.roles` and the portal's server enforces the role (amended 2026-11-21: the ERP cannot tell which client calls it).
>
> Updated 2026-11-21 (ERP-0106, port plan P1): signed-in devices and deleting one's own login. The login settings columns (`portal_language`, `portal_two_step`, `portal_push`) and the emailed two-step code were removed the same day (owner decision): the language is the request's `Accept-Language`, push notices come over the backend websocket, a second factor is Better Auth's job (not built yet).

# Customer Portal Module (ERP-0022, stage 1)

Decision records: [ADR-0022](../decisions/ADR-0022-customer-portal-api.md), session transport and role [ADR-0027](../decisions/ADR-0027-portal-session-cookie-and-customer-role.md).
API reference: Swagger/OpenAPI served by `@elysia/openapi` from the backend at `/docs`.
Full gap analysis against the website repo (all 51 portal, 9 catalog and 10
website operations, open owner decisions): `docs/plan/plans/website-integration.md`.

## Purpose and boundary

The API the customer portal (`apps/web-customer-portal`) calls **from its server**. Stage 1 = M07 T26 (projects, BAST,
own tickets) + the account part of M12 T25 + warranties.

| Piece | Owner | Where |
| --- | --- | --- |
| Portal logins (`customer.customers`), invite / resend / revoke | Customer | `src/app/customer` (`PortalAccountService`, `/admin/customers/portal-accounts`) |
| Sign-in, sessions, passwords, lockout, devices; the `/customers/portal/v1` routes | Customer | `src/app/customer` (`portal.controller.ts`, `PortalAuthService`) |
| Deleting one's own login | Customer | `PortalAccountService` |
| Session cookie → active portal login guard (returns the user's roles) | Authorization | `src/authorization/portal-auth.ts`, `domainPlugin({ guards: 'portal' })` |
| Only the `customer` role holds a portal session (sign-in actions + middleware) | Customer portal app | `apps/web-customer-portal/src/lib/portal-role.ts`, `src/actions/index.ts`, `src/middleware.ts` |
| `customer` role granted on invitation and verified sign-up | User (identity) | `ExportedUserService.grantCustomerRole` → `BetterAuthUserAccountGateway` |
| Project view without costs | Project | `ProjectPortalService` |
| Tickets, message thread, customer confirmation | Ticket | `ticket` module (`ticket.tickets`, `ticket.ticket_messages`) |
| Devices and warranty | Project | `WarrantyService` (`project.warranties`) |

Rules (owner decisions D1/D2, 2026-11-14): one login per person (customer
contact) with a role `owner | approver | finance | viewer`; individuals sign
up themselves (emailed 6-digit code), businesses are invited by staff and an
owner invites colleagues; a portal user is never an organization member and
the web admin refuses its sign-in; every read is scoped to the customer of
the session; another customer's record is 404; no costs, contract values,
internal notes or staff ids in any response.

## Configuration

`PORTAL_URL` (backend `.env`) = the portal's base URL. Invitation and reset
emails link to `<PORTAL_URL>/reset-password?token=…`; without it invitations
answer 503. The portal sets `ERP_API_BASE_URL` to the ERP and these routes.

## Route map for `PortalRoutes` (`apps/web-customer-portal/src/api/portal.ts`)

Responses use the ERP envelope `{ requestId, status, message, timestamp, data }`
(errors add `errors[]`) — configure the
adapter with `unwrap` for `data`. Send `Accept-Language: id` or `en` for the
labels.

**Session (ADR-0027).** `login` and `verifyEmail` answer `Set-Cookie` with Better
Auth's session cookie (its own name and attributes); the body carries only the
user and `session.expiresAt`, never the token. The portal's server keeps the
`name=value` pair in its server-side Astro session and sends it as the `Cookie`
header on every authenticated route; the browser never holds it.
`Authorization: Bearer` is not accepted. `logout` answers a clearing
`Set-Cookie`. The guard, sign-in and sign-up verification require the global
role `customer` (comma-joined `auth.users.role`) **and** an active portal login;
a staff login gets the same 401 as a wrong password. New passwords are 12-128
characters (`register`, `resetPassword`, `changePassword`). Every route
publishes a `summary` and the zod schema it parses as the OpenAPI
`requestBody` (`src/http/openapi.ts`).

**Language.** The portal keeps the visitor's language in its own cookie and
sends it as `Accept-Language` on every call (as web-admin does); the ERP
stores no language, push or two-step setting for a portal login (owner
decision 2026-11-21). The portal passes the visitor's `User-Agent` /
`X-Forwarded-For` on `login` and `verifyEmail` so the session names its
device.

**Devices and deleting the login (ERP-0106).** Devices are Better Auth
sessions of the login (`listSessions`), addressed by session **id**; tokens
never leave the ERP. Deleting one's own login needs the password and revokes
the login like a staff revoke (`portal_status = revoked`, `user_id` freed,
every session ended); the person, company, documents and
history stay. The only active owner of a company account is refused (409); an
individual customer (no company) is their own account and may.

| `PortalSource` operation | Method and ERP path | Notes |
| --- | --- | --- |
| `login` | `POST /customers/portal/v1/auth/login` | `{ email, password, accountType? }` → `Set-Cookie` + `{ ok: true, user, session: { expiresAt } }` (`user.roles` = global roles; the portal refuses any login without `customer`); 401 wrong credentials or no active portal login, 423 locked (5 failures, 15 min) |
| `register` | `POST /customers/portal/v1/auth/register` | `{ accountType, name, email, phone?, password }` → `{ email }`; `business` → 403 (invitation); same answer for a known email |
| `verifyEmail` | `POST /customers/portal/v1/auth/verify-email` | `{ email, code }` → `Set-Cookie` + `{ user, session: { expiresAt } }` (creates the individual customer with an owner login and grants `customer`); 400 wrong/expired (5 attempts, 10 min) |
| `resendVerification` | `POST /customers/portal/v1/auth/verify-email/resend` | `{ email }`; always 200 |
| `requestPasswordReset` | `POST /customers/portal/v1/auth/password-reset` | `{ email }`; always 200 |
| `resetPassword` | `POST /customers/portal/v1/auth/password-reset/confirm` | `{ token, password }`; 400 invalid/expired. Also sets the first password after an invitation |
| `logout` | `POST /customers/portal/v1/auth/logout` | session cookie; answers a clearing `Set-Cookie` |
| `changePassword` | `POST /customers/portal/v1/account/password` | `{ current, next }`; 400 wrong current |
| — (session user) | `GET /customers/portal/v1/me` | `PortalUser` |
| `getHome` | `GET /customers/portal/v1/home` | active project + open tickets; quotations/activity empty in stage 1 |
| `getBadges` | `GET /customers/portal/v1/badges` | `openTickets`; the rest 0 in stage 1 |
| `listProjects` | `GET /customers/portal/v1/projects` | `ProjectSummary[]` |
| `getProject` | `GET /customers/portal/v1/projects/:id` | `ProjectDetail`; file links are signed for 5 minutes |
| `listTickets` | `GET /customers/portal/v1/tickets` | `TicketSummary[]` |
| `getTicket` | `GET /customers/portal/v1/tickets/:id` | `TicketDetail` + `canConfirm` |
| `createTicket` | `POST /customers/portal/v1/tickets` | JSON or the form (`payload`); photos → 422 in stage 1 |
| `postTicketMessage` | `POST /customers/portal/v1/tickets/:id/messages` | `{ text }`; files → 422 |
| — (new) | `POST /customers/portal/v1/tickets/:id/confirm` | the customer confirms a resolved ticket → closed |
| `listProducts` | `GET /customers/portal/v1/products` | one device per warranty-certificate line, id `<certificate>:<line>` |
| `getWarranty` | `GET /customers/portal/v1/products/:id/warranty` | `WarrantyDetail` |
| `getAccount` | `GET /customers/portal/v1/account` | `AccountSettings` with the members, `security.activeDevices` and `preferences.language` (= the request's `Accept-Language`); sites are empty (P2); no stored settings |
| `listDevices` | `GET /customers/portal/v1/account/devices` | `[{ id, userAgent, ipAddress, createdAt, updatedAt, current }]`, current first; no tokens |
| `revokeDevice` | `DELETE /customers/portal/v1/account/devices/:id` | session id; 404 gone or another login's |
| `signOutOtherDevices` | `POST /customers/portal/v1/account/devices/sign-out-others` | every session except this one |
| `closeAccount` | `POST /customers/portal/v1/account/close` | `{ password }`; clearing `Set-Cookie`; 400 wrong password, 409 only owner of a company |
| `inviteMember` | `POST /customers/portal/v1/account/members` | owner only: `{ email, name?, role: approver\|finance\|viewer }` → `CompanyMember`; 403 other roles |
| `removeMember` | `DELETE /customers/portal/v1/account/members/:id` | owner only; 422 for oneself |

Not built yet (stage 2, routes left unset so the adapter throws
`PortalNotConfiguredError`): `refreshSession` (sessions are Better Auth's 7-day sessions, refreshed on use),
`completeOnboarding`, notifications, orders, quotations, invoices, payments,
device registration and lookup, service booking, profile, documents,
`updatePersonal`/`updateCompany`, sites, wishlist, public
order lookup, RFQs.

## Staff side

- Customer page → **Customer portal** card: every login of the customer with
  its role and status; invite a person (name, email, role — a new contact is
  created), resend the link, revoke. `portal_account:read | invite | revoke` (admin, owner, sales
  manager, customer service).
- Ticket page → **Messages**: internal notes or replies visible to the
  customer; the customer's messages appear here. Writing needs
  `service_ticket:update`.

## Tests

`test/unit/portal-account.test.ts` (invitations and refusals, the `customer`
role granted on invitation and sign-up, sign-in and lockout, the session cookie
on sign-in / cleared on logout, bearer refused, a login without `customer`
passed through with its roles for the client to refuse, password length, the guard on a real route; ERP-0106: devices without tokens, deleting one's
own login incl. the only-owner refusal, the account answering in the
`Accept-Language`, the removed two-step and settings routes answering 404, and
the HTTP routes) and
`test/unit/portal-data.test.ts` (cross-customer denial for projects, tickets
and devices, no internal notes or costs, confirmation). The portal's own role
check is covered by `apps/web-customer-portal/src/lib/portal-role.test.ts`. E2E against a
throwaway local database: `progress.md` 2026-11-14 and 2026-11-21 (ERP-0094, ERP-0106).

Left for P2 (ERP-0100): account pages (profile, company change request,
sites, onboarding, members screens). A second sign-in factor via Better Auth's
`twoFactor` plugin is not built (owner decision 2026-11-21).
