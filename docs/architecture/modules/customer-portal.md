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
| Portal logins (`auth.portal_identities`), invite / resend / revoke | Identity | `src/app/user` (`PortalAccountService`, `/admin/portal-accounts`) |
| Sign-in, sessions, passwords, lockout; the `/portal/v1` routes | Portal (no tables) | `src/app/portal` |
| Session cookie → `customer` role → identity guard (ADR-0024) | Authorization | `src/authorization/portal-auth.ts`, `domainPlugin({ guards: 'portal' })` |
| Project view without costs | Projects | `ProjectPortalService` |
| Tickets, message thread, customer confirmation | After-sales | `ServiceTicketService.*ForCustomer / *FromPortal`, `service_ticket_comments` |
| Devices and warranty | After-sales | `WarrantyService.listForCustomer / getForCustomer` |

Rules (owner decisions D1/D2, 2026-11-14): one login per person (customer
contact) with a role `owner | approver | finance | viewer`; individuals sign
up themselves (emailed 6-digit code), businesses are invited by staff and an
owner invites colleagues; a portal user is never an organization member and
the web admin refuses its sign-in; every read is scoped to the customer of
the session; another customer's record is 404; no costs, contract values,
internal notes or staff ids in any response.

Session and role (ADR-0024, ERP-0069, 2026-11-19): every portal login carries
the global Better Auth role `customer`; the guard requires it **and** an
active identity. The session is Better Auth's own session cookie, handed to
the portal's **server** as `Set-Cookie` and sent back as a `Cookie` header;
it never reaches a browser and never appears in a response body.

## Configuration

`PORTAL_URL` (backend `.env`) = the portal's base URL. Invitation and reset
emails link to `<PORTAL_URL>/reset-password?token=…`; without it invitations
answer 503. The portal sets `ERP_API_BASE_URL` to the ERP and these routes.

## Route map for `PortalRoutes` (`apps/web-customer-portal/src/api/portal.ts`)

Responses use the ERP envelope `{ requestId, status, message, timestamp, data }`
(errors add `errors[]`) — configure the
adapter with `unwrap` for `data`. Send `Accept-Language: id` or `en` for the
labels. Authenticated routes need the session cookie from sign-in as the `Cookie` header
(`Authorization: Bearer` is refused). Request bodies are published in the OpenAPI
document at `/docs` (tag "Customer portal").

| `PortalSource` operation | Method and ERP path | Notes |
| --- | --- | --- |
| `login` | `POST /portal/v1/auth/login` | `{ email, password, accountType? }` → `Set-Cookie` (session) + `{ ok: true, user, session: { expiresAt } }`; 401 wrong credentials or no `customer` role, 423 locked (5 failures, 15 min). With two-step sign-in on (ERP-0081): no session, `{ ok: false, twoStep: true, challenge, email }` (masked) and a 6-digit code by email |
| `verifyLoginCode` | `POST /portal/v1/auth/login/verify` | ERP-0081: `{ challenge, code }` → `Set-Cookie` (session) + `{ ok: true, user, session }`; 400 wrong/expired (5 attempts, 10 min, Redis `portal:login-code:*`, code hashed) |
| `resendLoginCode` | `POST /portal/v1/auth/login/resend` | `{ challenge }`; always 200 |
| `register` | `POST /portal/v1/auth/register` | `{ accountType, name, email, phone?, password (12-128) }` → `{ email }`; `business` → 403 (invitation); same answer for a known email |
| `verifyEmail` | `POST /portal/v1/auth/verify-email` | `{ email, code }` → `Set-Cookie` (session) + `{ user, session: { expiresAt } }` (creates customer, contact, owner login with the `customer` role); 400 wrong/expired (5 attempts, 10 min) |
| `resendVerification` | `POST /portal/v1/auth/verify-email/resend` | `{ email }`; always 200 |
| `requestPasswordReset` | `POST /portal/v1/auth/password-reset` | `{ email }`; always 200 |
| `resetPassword` | `POST /portal/v1/auth/password-reset/confirm` | `{ token, password (12-128) }`; 400 invalid/expired. Also sets the first password after an invitation |
| `logout` | `POST /portal/v1/auth/logout` | session cookie; answers a clearing `Set-Cookie` |
| `changePassword` | `POST /portal/v1/account/password` | `{ current, next (12-128) }`; 400 wrong current |
| `listDevices` | `GET /portal/v1/account/devices` | ERP-0081: Better Auth sessions of the login `{ id, userAgent, ipAddress, createdAt, updatedAt, current }`; never the session token. The portal server forwards the visitor's `User-Agent` / `X-Forwarded-For` on sign-in |
| `revokeDevice` | `DELETE /portal/v1/account/devices/:id` | by session id (the token is looked up server-side); 404 when gone or another login's |
| `signOutOtherDevices` | `POST /portal/v1/account/devices/sign-out-others` | every session but this one |
| `closeAccount` | `POST /portal/v1/account/close` | ERP-0081, owner decision 2026-11-20: `{ password }`; revokes this portal identity (soft: `status revoked`, `deleted_at`) and ends its sessions; customer, orders and documents stay. 400 wrong password, 409 `portal.lastOwner` for the only active owner of a business customer (an individual may close) |
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
| `getAccount` | `GET /portal/v1/account` | `AccountSettings` with the members; sites/notifications/security are defaults (not stored yet) |
| `inviteMember` | `POST /portal/v1/account/members` | owner only: `{ email, name?, role: approver\|finance\|viewer }` → `CompanyMember`; 403 other roles |
| `removeMember` | `DELETE /portal/v1/account/members/:id` | owner only; 422 for oneself |

### Ordering, quotations, orders, invoices and payment (ERP-0070)

Decisions (owner 2026-11-14, user 2026-11-19): ordering uses the **website's**
catalog and checkout (one cart); the checkout calls these routes as the
signed-in customer (hand-off session). An order becomes a **draft SPH** owned
by the customer's account manager — a staff user, never a portal login —
else by the company setting `sales` / `online_order_owner_user_id` (503
`sales.onlineOrderNotConfigured` when neither is an active staff user); the
salesperson gets the `sales.online_order_received` notification. Sales
reviews, approves and sends the SPH as usual; the customer accepts a `sent`
SPH and that creates the sales order. Invoices stay organization-scoped in
Sales; a customer sees its issued invoices in every organization. Only
list-priced, published, in-stock products can be ordered; the checkout VAT is
the standard 11 % estimate (the SPH is authoritative). Roles: owner/approver
order, accept and ask for revisions; owner/finance pay; viewer reads.
Services: `PortalSalesService` (portal) over `CustomerSalesService`
(sales), `CatalogService.orderLines`, `GatewayPaymentService.open`.

| Operation | Method and ERP path | Notes |
| --- | --- | --- |
| website `quoteOrder` | `POST /portal/v1/checkout/quote` | `{ items[{productSlug, quantity}] }` (the website's `CheckoutOrder`; other fields ignored) → `OrderQuote` with `quoteId` |
| website `placeOrder` | `POST /portal/v1/checkout/orders` | the order + `quoteId` (+ `poNumber`, `notes`, `source: web`) → `{ orderNumber: <SPH code>, total, paymentStatus: pending_approval }`; 409 changed prices/availability, 403 viewer/finance |
| website `getPaymentStatus` | `GET /portal/v1/checkout/orders/:orderNumber` | the SPH number URL-encoded (it contains `/`) |
| `listQuotations` | `GET /portal/v1/quotations` | `QuotationSummary[]`; status `in_review` (draft→approved), `needs_approval` (sent), `expired`, `accepted` (won), `rejected` (lost); superseded revisions hidden |
| `getQuotation` | `GET /portal/v1/quotations/:id` | `QuotationDetail` with `approvers` (active owners/approvers) |
| `acceptQuotation` | `POST /portal/v1/quotations/:id/accept` | `{ approverId (= caller's identity), poNumber? }` → creates the sales order; 409 not `sent` |
| `requestQuotationRevision` | `POST /portal/v1/quotations/:id/revision` | `{ topics[], message }` → notifies the salesperson; attachments 422 |
| `listOrders` / `getOrder` | `GET /portal/v1/orders`, `/orders/:id` | sales orders → `OrderSummary` / `OrderDetail` from the tracking stages (ERP-0080): received, paid, production, qc, shipped, installation (only with a project), completed; detail carries the timeline, courier + AWB of the latest delivery note, site contact, installation, payment (`fullyPaid`) and invoice PDFs; 404 for another customer's order |
| `listInvoices` / `getInvoice` | `GET /portal/v1/invoices`, `/invoices/:id` | issued, partially paid and paid invoices only |
| `listPaymentMethods` | `GET /portal/v1/payment-methods` | the active gateway as one method (`id` = provider); empty when none |
| `payInvoice` | `POST /portal/v1/invoices/:id/pay` | `{ methodId }` → `{ instructionsUrl, reference }` (gateway checkout, reused while pending) |
| `listRfqs` | `GET /portal/v1/rfqs` | website RFQs of the account (ERP-0072): submitted signed in (`origin: account`) or claimed (`claimed_guest`); status `received` (new), `in_review` (contacted/survey), `quoted` (quotation stage or a non-draft SPH for the lead, `quotationId`), `closed` (won/lost) |
| `requestRfqClaim` | `POST /portal/v1/rfqs/claim` | `{ reference }` → `{ reference, maskedEmail, expiresInMinutes: 15 }`; a 6-digit code is mailed to the RFQ's address; 404 unknown, already in an account, or no email |
| `confirmRfqClaim` | `POST /portal/v1/rfqs/claim/confirm` | `{ reference, code }` → 200; 400 wrong/expired code (5 attempts, then start over); the code is bound to the account that asked |
| `lookupPublicOrder` | `GET /public/v1/orders/:id/status` | no session, no key (ERP-0073): sales order number URL-encoded → `PublicOrderStatus` without customer, prices or addresses (title "Order of N item(s)"); 404 unknown; 429 after 30 lookups / 10 minutes per address |
| website `trackOrder` | `POST /public/v1/orders/track` | website key; `{ orderNumber, contact }` → `PublicTracking` when `contact` is the order's email (exact) or whole phone (0/62/+62 forms); unknown order and wrong contact both 404. Stages: received, paid (all issued invoices paid), production (order past `confirmed`), qc (a delivery note), shipped (a shipped/delivered note), installation (only with a project; task progress), completed |
| website `getCart` / `syncCart` | `GET /portal/v1/cart`, `POST /portal/v1/cart/sync` | as the signed-in customer (ERP-0074): `{ lines[{productSlug, quantity, options?}], mode: merge|replace }` → the saved cart; merge keeps the larger quantity per product + options; unknown/unpublished products dropped; 50 lines |
| website `syncWishlist` | `POST /portal/v1/wishlist/sync` | `{ slugs[], mode }` → saved slugs (100 max); merge once after sign-in, replace after each heart toggle |
| `listWishlist` / `removeWishlistItem` | `GET /portal/v1/wishlist`, `DELETE /portal/v1/wishlist/:id` | saved products still published (`WishlistItem`: name, category, price label, stock, image); removing another account's item → 404 |
| `getProfile` | `GET /portal/v1/profile` | counts and amounts for the profile page (orders, projects, devices, tickets, SPHs awaiting, outstanding, sites, warranties expiring in 60 days, documents, members, approvers) — ERP-0075 |
| `updatePersonal` | `PATCH /portal/v1/account/personal` | `{ name, phone, jobTitle? }`: the name on the login (Better Auth), phone and job title on the CRM contact behind it |
| `updateSettings` | `PATCH /portal/v1/account/settings` | notification channels, language and two-step sign-in (`security.twoStep`, ERP-0081) per login (`auth.user_preferences`); face ID and appearance were removed (user decision 2026-11-20) |
| `saveSite` / `deleteSite` | `POST /portal/v1/account/sites`, `PATCH` / `DELETE /account/sites/:id` | installation sites (`crm.customer_addresses` kind `site`): owners and approvers (403 otherwise); first site primary, removing the primary promotes the oldest; 30 max |
| `completeOnboarding` | `POST /portal/v1/onboarding` | `{ siteAddress, invites[] }`: the first site (when none) and colleague invites; failed invites are reported, not fatal |
| `listDocuments` | `GET /portal/v1/documents?folder=` | invoices and sent SPHs (listed), warranty certificates, customer-visible project files (short-lived link) |
| `updateCompany` | `PATCH /portal/v1/account/company` | owners of business accounts (ERP-0076): `{ name, npwp?, industry? }` becomes a change request reviewed by sales (not a direct edit); the account manager is notified; while pending, `company.verified` is `false`; 422 when nothing differs or for an individual; 403 for other roles |
| `listNotifications` | `GET /portal/v1/notifications` | latest 50 in-app notifications of the login (ERP-0077): SPH sent, delivery shipped, invoice issued, payment received (staff or online), support reply visible to the customer; kind + link per template; opening the list marks them read; `getBadges` / `getHome` count the unread |
| (download) | `GET /portal/v1/documents/:kind/:id/file` | ERP-0079: kind `quotation` (sent SPHs) / `invoice` / `warranty` → a PDF rendered on request from the print view (render token, headless Chromium); kind `file` → 302 to a customer-visible project file. The portal serves it at `/documents/file/:kind/:id` (its server streams it with the customer's session). 404 for another customer's document, 503 when PDF rendering is not configured |
| website `submitRfq` (signed in) | `POST /public/v1/rfq` | website key **and** the customer's session cookie → the RFQ joins that account (`linkedToAccount: true`); a guest RFQ answers `false` |

Not built yet (routes left unset so the adapter throws
`PortalNotConfiguredError`): `refreshSession` (sessions are Better Auth's 7-day sessions, refreshed on use),
nothing else. Deferred by owner decision (2026-11-20): device registration and service
booking, promo codes.

## Staff side

- Customer page → **Customer portal** card: every login of the customer with
  its role and status; invite a person (name, email, role — a new contact is
  created), resend the link, revoke. `portal_account:read | invite | revoke` (admin, owner, sales
  manager, customer service).
- Ticket page → **Messages**: internal notes or replies visible to the
  customer; the customer's messages appear here. Writing needs
  `service_ticket:update`.

## Tests

`test/unit/portal-sales.test.ts` (ERP-0070: SPH owner resolution, customer
scoping, sent-only answers, checkout 409s, portal roles, gateway payment);
`test/unit/customer-portal.test.ts` (invitations and refusals, sign-in and
lockout, cross-customer denial for projects/tickets/devices, no internal notes
or costs, confirmation, the guard on a real route). E2E against a disposable
database: `progress.md` 2026-11-14.
