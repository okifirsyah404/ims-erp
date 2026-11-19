# Entragate Public Website

Marketing site and online store for **entragate.com**. Astro SSR (Node standalone adapter),
Tailwind v4 and shared design tokens. Deploys independently of `apps/web-customer-portal`.

```sh
bun run dev      # http://localhost:4321 (sample data, forms accepted locally)
bun run build    # dist/server/entry.mjs + dist/client
```

Design source: `designs/entragate-final.pen`. Photography is shipped as WebP in `public/images`;
`src/lib/images.ts` maps each file back to its `designs/assets/generated-*.png` source.

## Environment

| Variable | Purpose |
| --- | --- |
| `WEB_DATA_SOURCE` | `demo` (sample data, forms answered locally) or `erp`. Defaults to `demo` in development and `erp` in production. |
| `ERP_API_BASE_URL` | External NestJS ERP API root. Must be https. |
| `ERP_API_TOKEN` | Website API key (`ewk_…`) for server-to-server calls, created in the ERP web admin under **Integrations → Website Settings → API keys** (shown once). Never sent to the browser. |
| `ERP_API_TIMEOUT_MS`, `ERP_RESPONSE_ENVELOPE` | Request timeout; set the envelope to `data` if the ERP wraps bodies as `{ data }`. |
| `ERP_RFQ_PATH` | Legacy RFQ path. Other routes live in `src/lib/server/website/erp-routes.ts`. |
| `PUBLIC_CUSTOMER_URL` | Customer Portal origin (sign-in, tickets, orders). |
| `PUBLIC_WHATSAPP_NUMBER` | Sales WhatsApp in international format without `+`. |

## ERP integration

- **Contract.** `WebsiteSource` in `packages/api-client/src/services/website.ts` lists every
  operation: `submitRfq`, `sendContactMessage`, `requestDemo`, `applyPromo`, `placeOrder`
  and `trackOrder`.
- **Catalog contract.** `CatalogSource` in `packages/api-client/src/services/catalog.ts`:
  `listProducts`, `getProduct`, `listCategories`, `getFacets`, `getStock`, `getPricing`,
  `listSolutions`, `search` and `priceCart` (zod-validated product payloads). The web
  adapter lives in `src/lib/server/catalog/`; `catalogRoutes` maps the nine operations to
  `/public/v1/catalog/*` (ERP-0070). Demo mode uses the labelled sample (`demo.ts`, "Sample data" badge);
  in ERP mode an unmapped route shows "catalog temporarily unavailable" instead of
  falling back to sample data.
- **Endpoints.** Relative paths live in `erp-routes.ts`; checkout (`quoteOrder`, `placeOrder`,
  `getPaymentStatus`) runs as the signed-in customer (ERP-0070). Unmapped operations return
  "not connected yet" messages instead of guessing endpoints.
- **Site configuration (ERP-0071 stage 1, ADR-0025).** Identity, contact, social links,
  default SEO, the header menu and the footer columns come from `GET /public/v1/site`
  (`src/lib/server/site/`), put on `Astro.locals.site` by `src/middleware.ts` and cached
  for a minute; unset fields keep the defaults in `src/data/site.ts`. Every page renders on
  request (`output: "server"`) so changes show without a rebuild.
- **Content (ERP-0071 stages 2-4).** Pages and collections written in the ERP
  (**Integrations → Website Content**) come from `GET /public/v1/site/pages/:type[/:slug]`
  through `src/lib/server/content/` (published only, cached for a minute, images as URLs).
  `null` from a loader means "nothing in the ERP": the page keeps its built-in content
  from `src/data/*.ts`, merged field by field. The home page uses `content/home.ts`;
  projects and testimonials use `content/projects.ts`, solutions `content/solutions.ts`, and
  the other pages (about, careers, news, help, legal `privacy` / `terms`, warranty,
  installation) `content/pages.ts`.
- **Server-side only.** All calls run in Astro Actions, so the token never reaches the browser.
- **Order pricing.** Prices are always recomputed on the server from the catalog
  (`computeTotals` in `src/data/checkout.ts`).
- **Order responses.** Order confirmations are validated, so payment links must be https.
- **Sample data, still to be replaced by ERP/CMS data.** The catalog (`src/data/catalog.ts`
  behind `src/lib/catalog.ts`), projects, the Knowledge Center, news, careers and the
  configurator price list are all clearly labelled samples.

## Routes

| Route | Frame | Notes |
| --- | --- | --- |
| `/` | 01.01 Home | |
| `/products`, `/products/[slug]` | 02.01, 02.02 | 18 sample products, category templates for detail pages. Filters, chips, search (debounced), sort and Load more update in place via `/products/results` |
| `/products/results` | — | HTML fragment (chips + results) for in-place catalog updates; noindex, no-store |
| `/api/search.json?q=` | — | Command palette (⌘K / Ctrl+K) results, grouped, 5 per group |
| `/products/compare?p=…` | 02.03 | up to 4 products |
| `/solutions`, `/solutions/[slug]`, `/solutions/demo` | 02.04, 02.05 | detail pages composed from 02.04 components |
| `/build` | 03.01 | 5-step configurator, auto-saved, shareable link, hands off to RFQ |
| `/quote` | 03.02 | RFQ |
| `/cart`, `/checkout` | 03.03 | cart in localStorage; confirmation step included |
| `/projects`, `/projects/[slug]` | 01.02 | case studies composed from portfolio patterns |
| `/track` | 07.04 | POST lookup (no personal data in URLs) |
| `/help`, `/help/topics/[topic]`, `/help/articles/[slug]` | 01.03 | search via `?q=` |
| `/help/documents`, `/help/videos`, `/help/training` | 01.04 + tabs | |
| `/about`, `/contact` | 09.01, 09.02 | |
| `/careers`, `/news`, `/news/[slug]`, `/warranty`, `/installation`, `/privacy`, `/terms`, `/search` | footer | composed from shared components |

## Interaction layer

- **Software Showcase (home).** Desktop pins the section with CSS sticky and maps scroll
  progress to the six software stages (`scripts/software-showcase.ts`, passive scroll + rAF,
  no wheel handling). Clicking an item scrolls to its stage; clicking the active item
  opens its page. Viewports too short to show the section, and mobile, switch on tap.
- **Motion.** `scripts/site.ts` + `global.css`: scroll reveal (`data-reveal`), card hover,
  button press, animated `<details>`, dropdown fade, smooth anchors, cross-document view
  transitions, skeletons. Everything is disabled under `prefers-reduced-motion`.
- **Header.** Products / Software Solutions mega menus (hover intent, chevron button,
  ↓ / Esc), mobile accordions, command palette.
- **Forms.** `scripts/form-validation.ts` gives inline errors; phone fields accept
  `08…`, `+628…` and landlines (`src/lib/phone.ts`), WhatsApp requires a mobile number, and
  the server normalises to `+62…`. In demo mode every success panel says nothing was sent.

## Checkout sign-in, cart and RFQ ownership

- **Local URLs.** `PUBLIC_WEB_URL` / `PUBLIC_CUSTOMER_URL` are optional: unset in development
  they resolve to `http://localhost:4321` and `http://localhost:4322`; in production to
  `https://entragate.com` and `https://customer.entragate.com` (`src/lib/urls.ts`).
- **Login-gated checkout.** Guests browse, fill the cart (localStorage) and see the cart summary
  on `/checkout`. "Sign in" goes to `/auth/login?next=/checkout` → portal `/connect/web?state=…`
  (portal login or registration) → `/auth/callback?code=…&state=…`. The callback checks the
  `state` stored in this site's session, exchanges the 60-second single-use code
  server-to-server (`WEB_HANDOFF_SECRET`, optional `CUSTOMER_INTERNAL_URL`) and keeps the
  customer + ERP access token in the server-side session (`eg_web_session`, httpOnly). No
  tokens in the browser. Return paths are allow-listed (`/checkout`, `/cart`, `/quote`);
  failures land on `/checkout?auth=…` with a manual retry, so there are no redirect loops.
- **Cart merge.** After sign-in the device cart is merged into the account cart once
  (`cart.sync` · `merge`: same product + options keep the larger quantity, unknown products are
  dropped); afterwards the device cart mirrors it (`replace`).
- **Wizard.** Details → address → delivery/installation → payment → review → payment status.
  `checkout.review` gets the authoritative quote (`quoteOrder`: ERP prices, stock, tax,
  shipping, discounts) and stores it in the session; `checkout.placeOrder` requires the signed-in
  customer, the same quote (fingerprint + expiry), re-quotes right before creating the order and
  sends an `Idempotency-Key`. Concurrent or repeated submits with the same key return the first
  order. `checkout.paymentStatus` only answers for the customer's own orders. Demo mode never
  reports a payment as made and labels every sample order.
- **Guest RFQ.** `/quote` needs no account (name, email, WhatsApp, optional company, project
  location, products and/or software, requirements, attachments). Signed-in RFQs are linked to
  the account; guest RFQs get a portal link (`/quotations/claim?reference=…`) where the owner
  proves ownership with a code emailed to the RFQ's address.
- **ERP routes** (`src/lib/server/website/erp-routes.ts`): contact, demo and RFQ forms
  (`/public/v1/contact`, `/demo`, `/rfq`; a signed-in customer's RFQ also sends their portal
  session and joins their account, ERP-0072) and checkout (`quoteOrder`, `placeOrder`,
  `getPaymentStatus`, ERP-0070). Promo codes are not built in the ERP: `applyPromo` is unmapped
  and the checkout hides the promo field. Order tracking (`trackOrder`, ERP-0073) answers only when
  the email or the whole phone number matches the order. The account cart and the wishlist hearts
  follow a signed-in customer (`getCart`, `syncCart`, `syncWishlist`, ERP-0074); guests keep them on
  the device.
