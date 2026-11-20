> Updated 2026-11-20 (ADR-0024): the portal API now lives in the `customer` module at `/customers/portal/v1` (was `/portal/v1`); tickets are owned by `ticket`, warranties by `project`. Request/response shapes below are unchanged.

# Customer Portal Module (ERP-0022, stage 1)

Decision record: [ADR-0022](../decisions/ADR-0022-customer-portal-api.md).
API reference: Swagger/OpenAPI served by `@elysia/openapi` from the backend at `/docs`.
Full gap analysis against the website repo (all 51 portal, 9 catalog and 10
website operations, open owner decisions): `docs/plan/plans/website-integration.md`.

## Purpose and boundary

The API the customer portal (`apps/web-customer-portal`) calls **from its server**. Stage 1 = M07 T26 (projects, BAST,
own tickets) + the account part of M12 T25 + warranties.

| Piece | Owner | Where |
| --- | --- | --- |
| Portal logins (`customer.customers`), invite / resend / revoke | Customer | `src/app/customer` (`PortalAccountService`, `/admin/customers/portal-accounts`) |
| Sign-in, sessions, passwords, lockout; the `/customers/portal/v1` routes | Customer | `src/app/customer` (`portal.controller.ts`) |
| Bearer → session → customer guard | Authorization | `src/authorization/portal-auth.ts`, `domainPlugin({ guards: 'portal' })` |
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
labels. Authenticated routes need `Authorization: Bearer <accessToken>`.

| `PortalSource` operation | Method and ERP path | Notes |
| --- | --- | --- |
| `login` | `POST /customers/portal/v1/auth/login` | `{ email, password, accountType? }` → `{ ok: true, user, tokens: { accessToken, expiresAt } }`; 401 wrong credentials, 423 locked (5 failures, 15 min) |
| `register` | `POST /customers/portal/v1/auth/register` | `{ accountType, name, email, phone?, password }` → `{ email }`; `business` → 403 (invitation); same answer for a known email |
| `verifyEmail` | `POST /customers/portal/v1/auth/verify-email` | `{ email, code }` → `{ user, tokens }` (creates customer, contact, owner login); 400 wrong/expired (5 attempts, 10 min) |
| `resendVerification` | `POST /customers/portal/v1/auth/verify-email/resend` | `{ email }`; always 200 |
| `requestPasswordReset` | `POST /customers/portal/v1/auth/password-reset` | `{ email }`; always 200 |
| `resetPassword` | `POST /customers/portal/v1/auth/password-reset/confirm` | `{ token, password }`; 400 invalid/expired. Also sets the first password after an invitation |
| `logout` | `POST /customers/portal/v1/auth/logout` | bearer |
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
| `getAccount` | `GET /customers/portal/v1/account` | `AccountSettings` with the members; sites/notifications/security are defaults (not stored yet) |
| `inviteMember` | `POST /customers/portal/v1/account/members` | owner only: `{ email, name?, role: approver\|finance\|viewer }` → `CompanyMember`; 403 other roles |
| `removeMember` | `DELETE /customers/portal/v1/account/members/:id` | owner only; 422 for oneself |

Not built yet (stage 2, routes left unset so the adapter throws
`PortalNotConfiguredError`): `refreshSession` (sessions are Better Auth's 7-day sessions, refreshed on use),
`completeOnboarding`, notifications, orders, quotations, invoices, payments,
device registration and lookup, service booking, profile, documents,
`updatePersonal`/`updateCompany`/`updateSettings`, sites, wishlist, public
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

`test/unit/customer-portal.test.ts` (invitations and refusals, sign-in and
lockout, cross-customer denial for projects/tickets/devices, no internal notes
or costs, confirmation, the guard on a real route). E2E against a disposable
database: `progress.md` 2026-11-14.
