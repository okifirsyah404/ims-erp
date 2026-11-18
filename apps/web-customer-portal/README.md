# Entragate Customer Portal

Mobile-first PWA for Entragate customers, served at **https://customer.entragate.com**.
Astro SSR (Node standalone adapter) with React islands. It deploys independently of `apps/web-landing`.

```sh
bun run dev      # http://localhost:4322 (demo data)
bun run build    # dist/server/entry.mjs + dist/client
node dist/server/entry.mjs
```

## Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `PORTAL_DATA_SOURCE` | server | `demo` (design fixtures) or `erp`. Defaults to `demo` in development, `erp` otherwise. |
| `ERP_API_BASE_URL` | server, secret | NestJS ERP API root, e.g. `https://erp.entragate.com/api/v1`. Must be https (http only for localhost). |
| `ERP_API_TIMEOUT_MS` | server | Per-request timeout (default 15000). |
| `ERP_RESPONSE_ENVELOPE` | server | `data` if the ERP wraps success bodies as `{ data: … }`, else `none`. |
| `ERP_ASSET_ORIGINS` | server | Extra https origins allowed for images (CSP), comma separated. |
| `PUBLIC_WEB_URL` | client | Marketing site, for "request a quote" links. |
| `PUBLIC_SUPPORT_WHATSAPP`, `PUBLIC_SUPPORT_PHONE` | client | Enables the WhatsApp and call buttons. |
| `HOST`, `PORT` | runtime | Node adapter listen address. |

The build needs none of the ERP secrets. A missing ERP configuration surfaces on the first request.

## ERP integration (external NestJS API)

The ERP repository is not modified from here. The portal consumes it **server-side only**:
the browser talks exclusively to this origin (CSP `connect-src 'self'`), and ERP access and
refresh tokens live in the server session. The cookie only carries an opaque session id.

- **Contract.** `PortalSource` in `packages/api-client/src/services/portal.ts` lists every
  operation the UI needs, with typed requests and responses.
- **Endpoints.** `src/services/portal/erp-routes.ts` maps operations to relative paths
  (`/portal/orders/:id`). It is empty until the ERP team publishes its routes. Unmapped
  operations fail with "This feature isn't connected yet" instead of guessing.
- **Domain services.** `src/services/index.ts` groups the contract for pages and actions:
  `authService`, `customerService` (home, badges, profile, account, notifications,
  documents, wishlist), `ordersService`, `projectsService`, `quotationsService`,
  `invoicesService`, `paymentsService`, `supportService` and `warrantyService`.
- **Operations awaiting ERP routes.** Every `PortalSource` operation needs a path. Besides
  auth, orders, projects, quotations, invoices, payments, tickets and warranty, the account
  area uses `getBadges`, `getAccount`, `updatePersonal` (PATCH), `updateCompany` (PATCH),
  `inviteMember`, `removeMember` (DELETE `:id`), `saveSite` (POST, or PATCH `:id`),
  `deleteSite` (DELETE `:id`), `updateSettings` (PATCH), `changePassword` (400/401/403 =
  wrong current password), `listWishlist`, `removeWishlistItem` (DELETE `:id`),
  `getInvoice` (`:id`, 404 = not found) and `postTicketMessage` (JSON, or multipart with
  `payload` + up to 3 `attachments` when files are sent).
- **Public lookup.** `/track` (07.05) calls `lookupPublicOrder` without a session and shows
  status only (no prices, addresses or contacts). It is rate limited per client address
  (20 lookups / 10 min, in memory). The ERP endpoint should also require something the
  customer holds (AWB or email) and apply its own rate limit before going live.
- **Transport** (`packages/api-client/src/client.ts`):
  - Bearer token on every request.
  - Requests are pinned to the base URL's origin and path (no absolute or `..` paths).
  - `redirect: "error"`, `cache: "no-store"`, timeouts.
  - One retry for GETs on network errors or 502/503/504.
  - `X-Request-Id` on every call; `Idempotency-Key` on payments.
- **Validation.** Responses that create identities, issue tokens or redirect the browser
  are validated with zod (`portal-schemas.ts`). A mismatch raises `ErpContractError`
  instead of trusting the data. URLs rendered from ERP data pass through
  `src/lib/safe-url.ts`.
- **NestJS errors.** `{ statusCode, message }` bodies become `ApiError.messages`.
  - 400/409/422 messages are shown to the user.
  - Other failures are logged with the request id and shown as a generic message.
  - Login failures (401/423) map to the "attempts left" and "account locked" states.
- **Sessions.**
  - Access tokens refresh one minute before expiry through `refreshSession`. Concurrent
    requests share a single refresh.
  - A 401 on any authenticated call signs the user out and returns them to `/login`
    with a "session ended" notice.

## Demo mode

With `PORTAL_DATA_SOURCE=demo` (the development default) every screen runs on fixtures in
`src/services/portal/demo*.ts` and a banner marks the app as **Demo mode**. Mutations
(accepting quotations, payments, tickets, invites, sites, settings…) only change in-memory
demo state and the confirmation says they were not sent to the ERP. Sign in with
`hendra@majulogistik.co.id` / `entragate-demo` (OTP `482913`).

## Layout & screens

- Mobile (390) is the primary layout: bottom tab bar (Home, Orders, Tracking, Support,
  Profile), sheets, safe areas. Tablet widens the column to 640px.
- From `xl` (1280) `CustomerLayout` swaps the tab bar for the desktop workspace nav
  (06.x). Screens with an approved desktop design render it with `desktop="full"`
  (Home 06.01, Orders 06.02, Tracking 06.03, Quotation 06.04, Products 06.05, Support
  06.06, Profile 06.07). Other screens show their mobile layout as a centred card.
- Auth screens use the split brand panel from `lg` (04.0x Desktop).

## PWA

Configured in `astro.config.mjs` with `@vite-pwa/astro`.

- **Manifest.** Name, theme `#0A1A3F`, standalone display, portrait orientation, shortcuts
  (Orders, Tracking, New ticket, Payments) and narrow screenshots (`public/screenshots`).
- **Icons.** `public/icons`: `any` icons at 64, 192 and 512; `maskable` icons at 192 and
  512; the Apple touch icon; plus `favicon.svg` (vector master) and `favicon.ico`.
- **Caching policy.** Only the static, user-agnostic shell is precached (about 700 KB):
  hashed `/_astro` JS/CSS, Latin font subsets, icons and the prerendered `/offline` page.
  - **Navigations are network-only.** Personalised SSR pages are never stored by the
    service worker. They are also sent with `Cache-Control: private, no-store`.
  - **Mutations bypass the service worker.** Actions and `/logout` are POSTs.
- **Offline.** A failed navigation shows `/offline`, which reloads automatically when the
  connection returns. A toast warns while the device is offline.
- **Updates.** The app checks for a new service worker on load, hourly and when it returns
  to the foreground. A waiting version shows a "new version" toast, and the user chooses
  when to reload, so a half-filled form is never lost. Old precaches are cleaned up on
  activation.
- **Sign-out.** Sends `Clear-Site-Data: "cache"`.

### Hosting checklist (reverse proxy / CDN)

- Terminate TLS and forward `X-Forwarded-Host: customer.entragate.com`. It is trusted via
  `security.allowedDomains`.
- Do not let a CDN cache HTML. Cache `/_astro/*` as immutable.
- Serve `/sw.js` and `/manifest.webmanifest` with `Cache-Control: no-cache`.
- Allow request bodies of about 130 MB on `/_actions/*` (ticket photo and video uploads).
- Running more than one instance? Switch the session driver from filesystem to a shared
  store such as Redis (`session` in `astro.config.mjs`).

## Website sign-in hand-off & RFQs

- `/connect/web?state=…` (signed-in only; guests are sent to `/login?next=…`, and registration
  keeps `next` through verification and setup) mints a single-use, 60-second code and redirects
  to `${PUBLIC_WEB_URL}/auth/callback` — never to a URL taken from the query.
- `POST /api/connect/token` exchanges the code server-to-server. It requires
  `WEB_HANDOFF_SECRET` (a fixed dev secret is used only in development) and returns the
  profile and the ERP access token, never the refresh token. Codes are kept in memory: run one
  instance or move them to a shared store before scaling out.
- `PUBLIC_WEB_URL` is optional: unset = `http://localhost:4321` in development,
  `https://entragate.com` in production (`src/lib/urls.ts`).
- **RFQs.** `/quotations` lists the account's RFQs (`listRfqs`). Guest RFQs are added at
  `/quotations/claim`: `requestRfqClaim` emails a code to the RFQ's address, `confirmRfqClaim`
  verifies it. Quotation details, revisions, approval (SPH) and conversion to orders stay behind
  portal sign-in. ERP routes still to map: `listRfqs`, `requestRfqClaim`, `confirmRfqClaim`.
- Login now keeps `next` on the form POST (it was dropped before, so "return to" after login
  always went to `/`).
