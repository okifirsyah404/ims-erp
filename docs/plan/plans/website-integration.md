# Website and Customer Portal Integration — Gap Analysis

Written 2026-11-14 for ERP-0022 (customer portal) and the website parts of
M02/M04 (ERP-0020, ERP-0021). It compares what the website repo expects with
what the ERP offers, operation by operation, and lists the owner decisions
that block the rest. Status words follow `backlog.md`; nothing here is
`verified` against the real website yet.

## Sources read

Website repo `C:\laragon\www\Personal\entragate-platform` (Bun monorepo, no
commits yet on `master`):

| Path | What it is |
| --- | --- |
| `packages/api-client/src/client.ts` | HTTP client: bearer `token`, `unwrap`, retries, `Idempotency-Key`, errors read `message` |
| `packages/api-client/src/services/portal.ts` (+ `portal-schemas.ts`) | `PortalSource` — 51 operations of the customer portal; login/tokens validated with zod |
| `packages/api-client/src/services/catalog.ts` | `CatalogSource` — 9 read operations, website service token |
| `packages/api-client/src/services/website.ts` (+ `rfq.ts`) | `WebsiteSource` — 10 operations: forms (service token) and checkout (customer token) |
| `apps/customer/src/services/portal/{index,erp-routes}.ts` | demo/erp switch; **`erpRoutes` is empty** |
| `apps/customer/src/pages/connect/web.ts`, `apps/web/src/lib/server/auth.ts` | website sign-in hand-off: the portal gives the website the customer's ERP access token |
| `apps/web/src/actions/index.ts`, `apps/web/src/lib/server/website/erp-routes.ts` | checkout/RFQ calls; only `submitRfq` can be mapped (`ERP_RFQ_PATH`) |
| `apps/*/astro.config.mjs` | `ERP_API_BASE_URL`, `ERP_API_TOKEN` (web), `ERP_RESPONSE_ENVELOPE`, `ERP_ASSET_ORIGINS`, `PORTAL_DATA_SOURCE` |

ERP side: `main` (`f64788d`), PR #84 `feat/m04-on-main` (catalog, outbox,
WhatsApp), branch `feat/m07-customer-portal` (`dc22cdf`, portal stage 1).

## How the website talks to the ERP

| Caller | Auth sent to the ERP | ERP guard today |
| --- | --- | --- |
| `apps/web` catalog + forms | `Authorization: Bearer <ERP_API_TOKEN>` (service key) | `publicApi` guard (Better Auth API key) on `/public/v1/*` |
| `apps/customer` (portal) | `Authorization: Bearer <customer accessToken>` | `portal` guard on `/portal/v1/*` (branch) |
| `apps/web` cart / checkout / payment status / RFQ while signed in | **only** the customer's `accessToken` (from the portal hand-off), no service key | **none yet** — must be `portal`-guarded routes |

Conventions both apps assume:

- Server-to-server only (browser never calls the ERP). No CORS needed.
- Envelope: set `ERP_RESPONSE_ENVELOPE=data` — the ERP answers
  `{ requestId, status, message, timestamp, data }`. Errors: the client reads `message` (string), which
  our error envelope has; login failures fall back to the status code (401
  wrong credentials, 423 locked).
- Money is **whole rupiah** (`Money = number`). The ERP stores minor units:
  every website/portal response must convert (`toRupiah` in the catalog does).
- Mutations send `Idempotency-Key` (RFQ, demo, payInvoice, placeOrder).
  `/public/v1` honours it; new mutating routes must too.
- Multipart = `payload` (JSON string) + files (`photos`, `attachments`).
- Images from ERP storage need their origin in `ERP_ASSET_ORIGINS` (signed
  object-storage URLs).

## Operation map

Legend: ✅ main · 🟡 PR #84 (open) · 🟦 branch `feat/m07-customer-portal` ·
❌ not built. "Owner module" = where the ERP side belongs.

### `CatalogSource` (apps/web) — 9/9 built, waiting for PR #84

| Operation | ERP route | Status | Owner |
| --- | --- | --- | --- |
| `listProducts` | `GET /public/v1/catalog/products` | 🟡 | catalog (M04) |
| `getProduct` | `GET /public/v1/catalog/products/:slug` | 🟡 | catalog |
| `listCategories` | `GET /public/v1/catalog/categories` | 🟡 | catalog |
| `getFacets` | `GET /public/v1/catalog/facets` | 🟡 | catalog |
| `getStock` | `GET /public/v1/catalog/stock?slug=` | 🟡 | catalog → inventory |
| `getPricing` | `GET /public/v1/catalog/pricing?slug=` | 🟡 | catalog |
| `listSolutions` | `GET /public/v1/catalog/solutions` | 🟡 | catalog |
| `search` | `GET /public/v1/catalog/search` | 🟡 | catalog |
| `priceCart` | `POST /public/v1/catalog/cart/price` | 🟡 | catalog |

### `WebsiteSource` (apps/web) — 3/10 built (`submitRfq` for guests only)

| Operation | ERP route | Status | Owner / blocker |
| --- | --- | --- | --- |
| `submitRfq` (guest) | `POST /public/v1/rfq` | ✅ | CRM (lead) |
| `submitRfq` (signed in) | — (customer token is refused by `/public/v1`) | ❌ | CRM + portal guard; `linkedToAccount` always `false` today |
| `sendContactMessage` | `POST /public/v1/contact` | ✅ | CRM |
| `requestDemo` | `POST /public/v1/demo` | ✅ | CRM |
| `applyPromo` | — | ❌ | commerce `promotions` (dbml target only); D6 |
| `getCart`, `syncCart` | — | ❌ | commerce (no cart table in dbml); D6 |
| `quoteOrder`, `placeOrder` | — | ❌ | commerce `commerce_orders` → sales order; ERP-0020; D5, D6 |
| `getPaymentStatus` | — | ❌ | payment gateway (ERP-0020); D5 |
| `trackOrder` (order number + contact) | — | ❌ | sales/delivery; D9 |

### `PortalSource` (apps/customer) — 22/51 built (+2 ERP extras)

| Group | Operation | ERP route | Status | Owner / blocker |
| --- | --- | --- | --- | --- |
| Auth | `login` | `POST /portal/v1/auth/login` | 🟦 | portal (lockout) |
| | `register` | `POST /portal/v1/auth/register` | 🟦 | Identity (D1: individuals; business → 403) |
| | `verifyEmail`, `resendVerification` | `POST /portal/v1/auth/verify-email[/resend]` | 🟦 | Identity + CRM (customer, contact, owner login) |
| | `requestPasswordReset` | `POST /portal/v1/auth/password-reset` | 🟦 | Identity |
| | `resetPassword` | `POST /portal/v1/auth/password-reset/confirm` | 🟦 | Identity (also first password) |
| | `logout` | `POST /portal/v1/auth/logout` | 🟦 | portal |
| | `refreshSession` | — | ❌ | D3 (leave unset: 7-day sliding Better Auth sessions) |
| | `changePassword` | `POST /portal/v1/account/password` | 🟦 | portal |
| | `completeOnboarding` | — | ❌ | sites (CRM `customer_addresses`, target only) + member invites |
| Home | `getHome` | `GET /portal/v1/home` | 🟦 partial | quotations/activity/onboarding/account manager empty |
| | `getBadges` | `GET /portal/v1/badges` | 🟦 partial | only `openTickets` |
| | `listNotifications` | — | ❌ | notification module (ERP-0047, programmer A) — producer for portal users needed |
| Projects | `listProjects`, `getProject` | `GET /portal/v1/projects[/:id]` | 🟦 | projects (no costs) |
| Orders | `listOrders`, `getOrder` | — | ❌ | sales order + delivery notes → portal DTO; stage 2 |
| | `lookupPublicOrder` (no sign-in) | — | ❌ | D9 |
| Quotations | `listQuotations`, `getQuotation` | — | ❌ | sales (SPH); stage 2 |
| | `acceptQuotation` | — | ❌ | **D4** (customer acceptance → Deal / SO) |
| | `requestQuotationRevision` | — | ❌ | D4 (→ CRM follow-up / revision request) |
| Invoices | `listInvoices`, `getInvoice` | — | ❌ | sales invoices; the web/API mismatch on main must be fixed first |
| | `listPaymentMethods`, `payInvoice` | — | ❌ | **D5** payment gateway (ERP-0020) |
| Support | `listTickets`, `getTicket`, `createTicket`, `postTicketMessage` | `/portal/v1/tickets…` | 🟦 | after-sales; photos/attachments refused (D7); no category/priority field (D7) |
| | — (ERP extra) | `POST /portal/v1/tickets/:id/confirm` | 🟦 | after-sales |
| | `getBookingOptions`, `bookService` | — | ❌ | **D8** (M07 excludes technician scheduling) |
| Devices | `listProducts`, `getWarranty` | `/portal/v1/products…` | 🟦 | after-sales (one device per warranty-certificate line) |
| | `lookupDevice`, `registerDevice` | — | ❌ | sales `findShipmentBySerial` exists; D10 |
| Documents | `listDocuments` | — | ❌ | document registry (ERP-0044) + signed files; stage 2 |
| Account | `getProfile` | — | ❌ | portal (counters) |
| | `getAccount` | `GET /portal/v1/account` | 🟦 | portal (members real; sites/settings defaults) |
| | `updatePersonal`, `updateCompany`, `updateSettings` | — | ❌ | Identity + CRM; D11 |
| | `inviteMember`, `removeMember` | `POST/DELETE /portal/v1/account/members` | 🟦 | Identity (owner only) |
| | `saveSite`, `deleteSite` | — | ❌ | CRM `customer_addresses` (dbml target only) |
| | `listWishlist`, `removeWishlistItem` | — | ❌ | commerce; D6 |
| RFQ | `listRfqs`, `requestRfqClaim`, `confirmRfqClaim` | — | ❌ | CRM leads by customer/email + email OTP |
| — | — (ERP extra) | `GET /portal/v1/me` | 🟦 | portal |

## Wiring status (2026-11-14)

The website repo's `apps/customer/src/services/portal/erp-routes.ts` now maps
the 21 built operations (not committed there: that repo has no commits yet).
`.env.example` documents `ERP_RESPONSE_ENVELOPE=data`. Home and profile show
empty sections for operations that are not connected yet
(`unlessNotConnected` in `apps/customer/src/services/errors.ts`) instead of an
error page. A browser walk-through against the local ERP passed: individual
sign-up → emailed code → signed in → home, projects, warranty, support →
new ticket (numbered by the ERP, listed) → profile → sign out → sign in again.

## Decisions taken

- **D1 (2026-11-14): individuals sign up themselves, businesses by
  invitation.** An `individual` sign-up is verified by an emailed code; the
  ERP then creates the CRM customer, its primary contact and an owner login.
  A `business` sign-up is refused (staff invite the company).
- **D2 (2026-11-14): one login per person (customer contact) with a role**
  `owner | approver | finance | viewer`. Staff invite the first contact as
  owner; an owner invites and removes colleagues from the portal. The web
  admin refuses customer logins.

## Decisions needed from the owner

The two marked ⚠ conflict with what was decided on 2026-11-14 and change the
schema already built on `feat/m07-customer-portal`.

| # | Question | What the website already assumes | Options / recommendation |
| --- | --- | --- | --- |
| **D1** ✅ decided (individuals sign up, businesses invited) | Who may create a portal account? | Open sign-up (`/register`, email OTP verification, `individual` or `business`); website checkout requires a portal sign-in | (a) invite-only (current build) — retail buyers cannot check out online; (b) open sign-up creates a *new* CRM customer on verification, staff merge duplicates; (c) open sign-up for `individual` only, business accounts by invitation. **Recommend (c)** if online retail sales are wanted, else (a) and hide the register page |
| **D2** ✅ decided (one login per contact + role; web admin refuses customer logins) | One login per customer or several people per company? | Company members with roles (owner / approver / finance / viewer), approval limits, onboarding invites | (a) one login (current build); (b) one login per **contact** (`crm.customer_contacts`), member role on the identity — needs a dbml/schema change (identity unique on the contact, not the customer) before the PR. **Recommend (b)** for business customers; it also gives `acceptQuotation` a real approver |
| D3 | Session refresh | Optional `refreshToken` | Leave `refreshSession` unset: Better Auth sessions slide for 7 days; on 401 the portal signs the user out. Recommend as is |
| **D4** | May a customer accept an SPH online? What happens? | Accept with PO number + approver; request a revision with topics | Recommend: accept = record the customer's acceptance on the SPH and notify sales; sales still creates the sales order (Deal) — no automatic order |
| **D5** | Online payment | VA BCA/Mandiri, QRIS, card, "invoice" (pay later) | Choose a gateway (Midtrans / Xendit / other) and get a sandbox; ERP-0020. Without it: only "invoice" payment and bank-transfer instructions |
| **D6** | Online shop scope | Cart sync, promo codes, wishlist, checkout with delivery + installation + tax invoice | Decide whether online ordering is in scope now. If yes: `commerce` module (orders → sales order), promotions; if no: hide cart/checkout and keep RFQ |
| D7 | Tickets: photos, category, priority | Photos on create and in messages; categories; priority | Store attachments (object storage) on the comment thread; map category/priority to new ticket columns or into the complaint text. Recommend attachments yes, priority as a column |
| **D8** | Service booking (pick a date and slot) | Booking calendar with slots | M07 plan excludes technician scheduling. Recommend: booking = a ticket with a requested date, staff confirm; no slot engine |
| D9 | Order tracking without sign-in | Order number + contact | Privacy risk (order number guessable). Recommend: require the email/phone on the order, minimal fields, rate limit |
| D10 | Customer registers a device by serial | Lookup and register a serial | Allow only serials shipped to that customer (`findShipmentBySerial`); others → staff review |
| D11 | Profile/settings (Face ID, two-step, notification channels, language) | Settings screens | Language + notification preferences only; hide Face ID/two-step until Better Auth passkey/2FA is enabled for portal users |

## Technical gaps the ERP must close (independent of the decisions)

1. **Customer-token routes for the website.** Signed-in RFQ, cart, checkout
   and payment status reach the ERP with the customer's token only. Put them
   under the `portal` guard (e.g. `/portal/v1/rfq`, `/portal/v1/shop/*`) — the
   website paths are configurable, so `apps/web` can point there.
2. **Money conversion** in every portal/website DTO (stage 1 returns no money).
3. **`Idempotency-Key`** on new mutations (`payInvoice`, `placeOrder`,
   `createTicket` retries).
4. **Invoice API on main** (web billing card / void routes missing) must be
   fixed before any portal invoice screen.
5. **Signed file URLs**: project files use 5-minute object-storage links; the
   website must list that origin in `ERP_ASSET_ORIGINS`. BAST and warranty
   *prints* are web-admin pages, not files — the portal shows them without a
   download link until a PDF is rendered/stored (document module).
6. **Notifications for portal users** (ERP-0047 inbox) — owned by programmer A.

## Website-side work (entragate-platform)

- Fill `apps/customer/src/services/portal/erp-routes.ts` with the 🟦 routes
  (map in `docs/architecture/modules/customer-portal.md`) and set
  `PORTAL_DATA_SOURCE=erp`, `ERP_API_BASE_URL`, `ERP_RESPONSE_ENVELOPE=data`,
  `ERP_ASSET_ORIGINS`.
- Fill `apps/web/src/lib/server/website/erp-routes.ts` / catalog routes with the
  ✅/🟡 routes; `ERP_API_TOKEN` = an ERP API key for the website (issued in
  the ERP).
- Hide or disable screens whose operations stay unmapped (the adapters throw
  `PortalNotConfiguredError` / show "not connected yet"), per decision D1–D11.
- Optional: the ticket detail `canConfirm` flag and `POST /tickets/:id/confirm`
  are ERP extras — add a `confirmTicket` operation to `PortalSource`.

## Proposed order of work

| Step | Content | Needs |
| --- | --- | --- |
| 0 | ✅ D1, D2 decided and built on `feat/m07-customer-portal` (2026-11-14) | — |
| 1 | Wire stage 1 routes in the website; run the portal against a staging ERP | website + ERP staging |
| 2 | Read-only sales documents: orders, quotations, invoices, documents, profile, badges/home complete | invoice API fix on main; money conversion |
| 3 | `acceptQuotation` / revision request, device lookup/register, ticket attachments, booking-as-ticket | D4, D7, D8, D10 |
| 4 | Signed-in RFQ, RFQ list/claim | portal-guarded CRM routes |
| 5 | Online shop: cart, promo, quote/place order, payment status, tracking | D5, D6, D9, ERP-0020 |
| 6 | Account/company members/sites/settings, notifications | D2, D11, ERP-0047 |
