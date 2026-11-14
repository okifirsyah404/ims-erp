# Customer Portal Module (ERP-0022, stage 1)

Decision record: [ADR-0018](../decisions/ADR-0018-customer-portal-api.md).
Full gap analysis against the website repo (all 51 portal, 9 catalog and 10
website operations, open owner decisions): `docs/plan/plans/website-integration.md`.

## Purpose and boundary

The API the customer portal (website repo `entragate-platform`,
`apps/customer`) calls **from its server**. Stage 1 = M07 T26 (projects, BAST,
own tickets) + the account part of M12 T25 + warranties.

| Piece | Owner | Where |
| --- | --- | --- |
| Portal logins (`auth.portal_identities`), invite / resend / revoke | Identity | `src/app/user` (`PortalAccountService`, `/admin/portal-accounts`) |
| Sign-in, sessions, passwords, lockout; the `/portal/v1` routes | Portal (no tables) | `src/app/portal` |
| Bearer → session → customer guard | Authorization | `src/authorization/portal-auth.ts`, `domainPlugin({ guards: 'portal' })` |
| Project view without costs | Projects | `ProjectPortalService` |
| Tickets, message thread, customer confirmation | After-sales | `ServiceTicketService.*ForCustomer / *FromPortal`, `service_ticket_comments` |
| Devices and warranty | After-sales | `WarrantyService.listForCustomer / getForCustomer` |

Rules: one login per customer, staff invitation only (no sign-up); a portal
user is never an organization member; every read is scoped to the customer of
the session; another customer's record is 404; no costs, contract values,
internal notes or staff ids in any response.

## Configuration

`PORTAL_URL` (backend `.env`) = the portal's base URL. Invitation and reset
emails link to `<PORTAL_URL>/reset-password?token=…`; without it invitations
answer 503. The portal sets `ERP_API_BASE_URL` to the ERP and these routes.

## Route map for `PortalRoutes` (website `packages/api-client`)

Responses use the ERP envelope `{ success, message, data }` — configure the
adapter with `unwrap` for `data`. Send `Accept-Language: id` or `en` for the
labels. Authenticated routes need `Authorization: Bearer <accessToken>`.

| `PortalSource` operation | Method and ERP path | Notes |
| --- | --- | --- |
| `login` | `POST /portal/v1/auth/login` | `{ email, password, accountType? }` → `{ ok: true, user, tokens: { accessToken, expiresAt } }`; 401 wrong credentials, 423 locked (5 failures, 15 min) |
| `register` | `POST /portal/v1/auth/register` | always 403 (invitation only) |
| `requestPasswordReset` | `POST /portal/v1/auth/password-reset` | `{ email }`; always 200 |
| `resetPassword` | `POST /portal/v1/auth/password-reset/confirm` | `{ token, password }`; 400 invalid/expired. Also sets the first password after an invitation |
| `logout` | `POST /portal/v1/auth/logout` | bearer |
| `changePassword` | `POST /portal/v1/account/password` | `{ current, next }`; 400 wrong current |
| — (session user) | `GET /portal/v1/me` | `PortalUser` |
| `getHome` | `GET /portal/v1/home` | active project + open tickets; quotations/activity empty in stage 1 |
| `getBadges` | `GET /portal/v1/badges` | `openTickets`; the rest 0 in stage 1 |
| `listProjects` | `GET /portal/v1/projects` | `ProjectSummary[]` |
| `getProject` | `GET /portal/v1/projects/:id` | `ProjectDetail`; file links are signed for 5 minutes |
| `listTickets` | `GET /portal/v1/tickets` | `TicketSummary[]` |
| `getTicket` | `GET /portal/v1/tickets/:id` | `TicketDetail` + `canConfirm` |
| `createTicket` | `POST /portal/v1/tickets` | JSON or the form (`payload`); photos → 422 in stage 1 |
| `postTicketMessage` | `POST /portal/v1/tickets/:id/messages` | `{ text }`; files → 422 |
| — (new) | `POST /portal/v1/tickets/:id/confirm` | the customer confirms a resolved ticket → closed |
| `listProducts` | `GET /portal/v1/products` | one device per warranty-certificate line, id `<certificate>:<line>` |
| `getWarranty` | `GET /portal/v1/products/:id/warranty` | `WarrantyDetail` |

Not built yet (stage 2, routes left unset so the adapter throws
`PortalNotConfiguredError`): `verifyEmail`, `resendVerification`,
`refreshSession` (sessions are Better Auth's 7-day sessions, refreshed on use),
`completeOnboarding`, notifications, orders, quotations, invoices, payments,
device registration and lookup, service booking, profile, documents,
account/company/members/sites/settings, wishlist, public order lookup, RFQs.

## Staff side

- Customer page → **Customer portal** card: invite (name, email), resend the
  link, revoke. `portal_account:read | invite | revoke` (admin, owner, sales
  manager, customer service).
- Ticket page → **Messages**: internal notes or replies visible to the
  customer; the customer's messages appear here. Writing needs
  `service_ticket:update`.

## Tests

`test/unit/customer-portal.test.ts` (invitations and refusals, sign-in and
lockout, cross-customer denial for projects/tickets/devices, no internal notes
or costs, confirmation, the guard on a real route). E2E against a disposable
database: `progress.md` 2026-11-14.
