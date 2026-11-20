# Port plan: customer portal + dynamic website onto main (ADR-0024 baseline)

**Status: proposal for discussion with Oki (2026-11-20). Nothing approved, no
code moved.** Written on `feat/erp-0069-portal-session` (Dafrin's local branch,
**not pushed yet**; commit ids below refer to it) after comparing it with
`origin/main` at `1c10c3e1`.

## 1. Where the two lines stand

| | `origin/main` | `feat/erp-0069-portal-session` |
| --- | --- | --- |
| Since the fork (`929209c6`, PR #114, 2026-11-19) | 27 commits | 18 commits (`1c9ec651` … `a051b4eb`) |
| Database | ADR-0024 normalization, ADR-0026 split: 20 schemas, 192 tables (19 / 188 at `1c10c3e1`) | old layout: 27 schemas, 285 tables (+5 tables, +columns) |
| Backend files touched | 761 (+96k / -27k lines) | 156 (+15.7k) |
| Files changed on both sides | 82 | |
| Portal backend | `customer` module: auth (bearer access token), `/me`, products, projects, tickets | `portal` module: server-held session cookie + `customer` role, ordering, SPH, orders, invoices, payment, tracking, documents, notifications, account pages, security |
| Website (web-landing) | catalog + RFQ/contact/demo forms on the ERP; other content demo data | identity, menus, pages and collections edited in the ERP; cart, wishlist, checkout, tracking |

Main's own ERP-0091 notes list as **backend gaps** almost exactly what this
branch built (cart, quote/place order, payment status, order tracking, orders,
quotations, invoices, payments, notifications, documents, profile, sites,
wishlist, onboarding, personal/company updates, ticket confirm, RFQ linked to
the account).

Commit and file counts in the table are as of `1c10c3e1`. Since then `main`
gained, among others, ADR-0026 (`product` and `warehouse` became their own
modules and schemas, the public catalog moved to `/products/public/v1/catalog`)
and the Astro dependency fix (PR #133).

**Merging main into the branch is not proposed:** most modules this branch
touches were renamed or reshaped on main (`sales`→`sale`, `aftersales`→`ticket`,
`crm`→`customer`/`supplier`, `projects`→`project`, `commerce` removed). The
plan is a **port per slice onto fresh branches from `origin/main`**, reusing
the UI, logic and tests and rewriting the schema/repository/route layer.

## 2. Decisions to agree first

| # | Question | Options | Proposal |
| --- | --- | --- | --- |
| D1 | Home of the dynamic website (`web_sites`, `web_pages`, `web_menus`, `web_menu_items`, `web_assets`) — main removed `commerce` as "target-only, returns through a new ADR if built" | a) new `website` schema/module · b) inside `company` | **a)** `website` module + ADR; it is built and used by web-landing. It would be the 21st schema (main has 20 since ADR-0026), so the schema counts in `AGENTS.md` and `docs/database/` change with it |
| D2 | Account cart and wishlist (`cart_items`, `wishlist_items`) | a) `customer` schema · b) `website` schema | **a)** `customer` (they belong to the portal account) |
| D3 | Portal login settings (push on/off, language, two-step) — main dropped `auth.user_preferences` | a) columns on `customer.customers` · b) bring back `auth.user_preferences` | **a)** `portal_language`, `portal_two_step`, `portal_push` on the person's row |
| D4 | The portal "account" | main splits `customer.companies` (B2B) and `customer.customers` (people) | account = `company_id` for a company contact, else the individual `customers.id`; every portal read scopes by it |
| D5 | Installation sites with a PIC (ERP-0075) | main: `customer.addresses` (people) + `customer.company_addresses` | add kind `site` + `contact_name`, `contact_phone` to both, or sites only on `company_addresses` (individuals use `addresses`) |
| D6 | Company change requests (ERP-0076) + `industry` | — | `customer.company_change_requests`; `industry` column on `customer.companies` |
| D7 | Website RFQ joined to a portal account (ERP-0072) | — | `project.leads` + `portal_customer_id`, `portal_linked_via`, `portal_linked_at` (main has `customer_id` for conversion only) |
| D8 | Courier/waybill (ERP-0080) | — | `sale.delivery_notes` + `courier_code`, `courier_service`, `waybill_number` |
| D9 | Ticket attachments (deferred on the branch) | — | `ticket.ticket_message_attachments` (storage key, like `project.lead_attachments`) |
| D10 | Portal session (ERP-0069): main still returns a bearer `accessToken` | keep bearer · server-held Better Auth cookie + global `customer` role | port the cookie + role model (portal app already depends on it) |
| D11 | Who builds what | — | Dafrin ports the portal/website slices below; Oki reviews schema PRs; no parallel work on the main ERP-0091 gap list |

## 3. Renumbering

ERP-0070..0091 and ADR-0024 are taken on main; ADR-0025
(`tanstack-table-for-web-admin`) and ADR-0026
(`product-and-warehouse-modules`) are taken on main too. Proposed (ERP numbers
checked free on main, every remote branch and open PRs on 2026-11-20 and again
on 2026-11-21 after PR #133 and #136 merged; the ADR numbers moved up by one
from the first draft, ADR-0026/0027, because ADR-0026 landed on main):

| Branch number | Port number | Slice |
| --- | --- | --- |
| ERP-0069 | ERP-0094 | Server-held session cookie, customer-only portal |
| ERP-0070 | ERP-0095 | Online ordering, quotations, orders, invoices, payment |
| ERP-0071 | ERP-0096 | Website configured in the ERP (stages 1-4) |
| ERP-0072 | ERP-0097 | Website forms to the ERP, RFQs join the portal |
| ERP-0073 | ERP-0098 | Public order tracking |
| ERP-0074 | ERP-0099 | Account cart and wishlist |
| ERP-0075 | ERP-0100 | Portal account pages |
| ERP-0076 | ERP-0101 | Company-data change requests |
| ERP-0077 | ERP-0102 | Customer notifications from ERP events |
| ERP-0078 | ERP-0103 | Sign-in back to the page; one checkout for priced + unpriced items |
| ERP-0079 | ERP-0104 | Document downloads (SPH, invoice, warranty PDF, project files) |
| ERP-0080 | ERP-0105 | Tracking from real data, courier and waybill |
| ERP-0081 | ERP-0106 | Security settings (2-step, devices, delete login) |
| ERP-0092 | ERP-0092 | Ticket thread gaps |
| ERP-0093 | ERP-0093 | Project-stage notices |
| ADR-0024 (portal session) | ADR-0027 | |
| ADR-0025 (website in the ERP) | ADR-0028 | also records D1 (`website` schema) |

## 4. Table and column mapping

| Branch (old layout) | Main target | Change on main |
| --- | --- | --- |
| `auth.portal_identities` | `customer.customers.user_id`, `portal_role`, `portal_status`, `portal_invited_by`, `portal_last_login_at` | none (exists) |
| `auth.user_preferences` keys `portal.notify.*`, `portal.language`, `portal.security.two_step` | `customer.customers` columns (D3) | add columns |
| `crm.customers` / `crm.customer_contacts` | `customer.companies` + `customer.customers` | none |
| `crm.customers.industry` | `customer.companies.industry` | add column |
| `crm.customer_addresses` (sites with PIC) | `customer.addresses` / `customer.company_addresses` (D5) | add kind + contact columns |
| `crm.customer_change_requests` | `customer.company_change_requests` | new table |
| `crm.leads.portal_*` | `project.leads.portal_*` | add columns |
| `commerce.web_sites`, `web_pages`, `web_menus`, `web_menu_items`, `web_assets` | `website.*` (D1) | new schema |
| `commerce.cart_items`, `commerce.wishlist_items` | `customer.cart_items`, `customer.wishlist_items` (D2) | new tables |
| `sales.delivery_notes` + courier columns | `sale.delivery_notes` | add columns |
| `sales.quotations`, `sales_orders`, `invoices`, `receipts` | `sale.quotations`, `sale.orders`, `sale.invoices`, `sale.receipts` | none |
| `aftersales.service_tickets`, `service_ticket_comments` | `ticket.tickets`, `ticket.ticket_messages` | none (+ D9 later) |
| `aftersales.warranty_certificates` | `project.warranties` | none |
| `notification.notification_templates`, `notifications` | `notification.push_notification_templates`, `push_notifications` | seed rows only |

Notification template codes follow the owning module on main:
`portal.*` → `customer.portal_*` (or kept as `portal.*` if Oki prefers one
customer-facing prefix), `aftersales.*` → `ticket.*`, `sales.*` → `sale.*`.
`TNotifyInput.dedupeKey` (ERP-0092) ports unchanged.

## 5. Route mapping

| Branch | Main target |
| --- | --- |
| `/portal/v1/auth/*`, `/portal/v1/*` | `/customers/portal/v1/auth/*`, `/customers/portal/v1/*` |
| `/public/v1/orders/:id/status` (tracking) | `/sales/public/v1/orders/:id/status` |
| `/public/v1/render/invoices/:id` | `/sales/public/v1/render/invoices/:id` |
| `/public/v1/render/warranties/:id` | `/projects/public/v1/render/warranties/:id` |
| `/public/v1/site*` (website content) | `/website/public/v1/*` |
| `/website/*` (staff editor) | `/website/*` (new module) |
| website forms + catalog | already on main: `/projects/public/v1/{rfq,contact,demo}`, `/products/public/v1/catalog/*` (served by the `product` module since ADR-0026) |
| `/service-tickets/*`, `/delivery-notes/*` (staff) | `/tickets/*`, `/sales/delivery-notes/*` |

The full branch route list is in `docs/architecture/modules/customer-portal.md`
on the branch.

## 6. Port order

Each slice: new branch from `origin/main`, `docs.dbml` first, then
`gen-logical-references.ts` + `validate-dbml.ts`, migration generated and
inspected, tests ported and green, live check, one PR. Sizes: S < 1 day,
M 1-2 days, L 3+ days.

| Step | Slices | What moves | Depends on | Size |
| --- | --- | --- | --- | --- |
| P1 | ERP-0094, ERP-0106 | Session cookie + `customer` role on main's `customer` portal auth; 2-step, devices, delete login; D3 columns | — | M |
| P2 | ERP-0100, ERP-0101 | Account pages (profile, company request, sites, settings, onboarding, members); D5, D6 | P1 | M |
| P3 | ERP-0095, ERP-0103 | Ordering, SPH, orders, invoices, payment; one checkout | P1 | L |
| P4 | ERP-0098, ERP-0105 | Public + portal tracking, courier/waybill (D8) | P3 | M |
| P5 | ERP-0104, ERP-0102 | Document downloads; customer notifications (`dedupeKey`) | P3 | M |
| P6 | ERP-0092, ERP-0093, D9 | Ticket thread gaps on `ticket`; project-stage notices; ticket attachments built here | P1, P5 | M |
| P7 | ERP-0096, ERP-0099, ERP-0097 | `website` module (ADR-0028), editor in web-admin, web-landing from the ERP; cart/wishlist (D2); RFQ joined to the account (D7) | P1, D1 | L |

web-landing and web-customer-portal changes travel with the backend slice
that needs them. Main's portal app already points at `/customers/portal/v1`;
the branch's pages, actions and adapter methods are copied over slice by slice.

## 7. Risks and open points

- Both Astro apps build on main. The proper fix for the earlier pin-back
  (`01473a2a`) landed with PR #133: `@vite-pwa/astro` 2, `@lucide/astro` 1.77,
  pins and dependabot ignores lifted. The ports start on current dependencies.
- Product and warehouse are separate modules since ADR-0026: ordering, the
  catalog and cart/wishlist product references (P3, P7) go through the
  `product` module's exported contract by id, never through `inventory`
  repositories; stock reads use the `inventory`/`warehouse` contracts.
- Main: tickets for **company** customers are unsupported (`getActiveCustomer`
  resolves people only); P6 must settle it together with D4.
- Online payment is still the `fake` gateway on dev on both lines.
- The branch's dev database has its own seed and test data; main's baseline
  migrations start a fresh database, so dev data is re-created, not migrated.
- The branch stays as a reference until P7 is merged; it is not pushed as a PR.
