# Shared patterns

Patterns every module file refers to. Changing one of them changes every
module, so they are settled in phase P0 (ERP-0070) before any module work.

## 1. `<schema>.code_numberings` (Q6)

Replaces `code_number.series` (ADR-0013 "one numbering authority" is
superseded by "one numbering table per owning schema"; ADR-0024).

```dbml
Table <schema>.code_numberings {
  id uuid [pk, default: `uuidv7()`]
  code_type varchar(32) [not null, note: "Code type owned by this module, e.g. quotation, sales_order."]
  pattern varchar(100) [note: "Token pattern, e.g. {SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}; null = code default."]
  reset_policy text [note: "never | yearly | monthly; null = code default."]
  period_key varchar(7) [not null, note: "2026, 2026-11 or all; a new period restarts at 1."]
  next_number bigint [not null, default: 1]
  updated_by text [note: "Logical reference to auth.users.id. Cross-module FK intentionally omitted. Validated through the Identity module contract."]
  created_at bigint [not null]
  updated_at bigint [not null]
  deleted_at bigint
  Note: "Code series of this module. Allocation is one atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING. Partial unique index on code_type WHERE deleted_at IS NULL."
  Checks {
    `reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')`
    `next_number > 0`
  }
}
```

Implementation:

- `apps/backend/src/shared/numbering/` (new): the pure parts of today's
  `code-number/domain/code-number.ts` - token rendering, period key, defaults
  per code type - plus `createCodeNumberingTable(schema)` (Drizzle column set)
  and `CodeNumberingRepositoryBase` (the atomic `allocate`, `findAll`,
  `saveSettings`). Shared helpers, not a module: no DI token, no schema.
- Each owning module: `repositories/code-numbering.repository.ts` extends the
  base with its own table (rule "one repository per table"), and its services
  allocate inside the same transaction as the document insert.
- The `{COMPANY}` token reads `company.profiles.document_code` through
  `ExportedCompanyService.getDocumentCode()`.
- Admin UI: each module exposes `GET/PATCH /admin/<prefix>/code-numberings`;
  the web-admin numbering settings page lists the modules and calls each
  (replaces `/code-numbers`).
- Data move: each `code_number.series` row goes to the schema of its
  `module` column (`crm` lead/web codes -> `project`, `assets` -> `inventory`,
  `aftersales` ticket -> `ticket`, warranty -> `project`, `licensing` ->
  `project`, `accounting` -> `finance`/`tax`). With the squash baseline (Q2)
  this is a seed concern, not a migration.

Schemas with `code_numberings`: customer, supplier, inventory, sale,
procurement, finance, tax, payment, project, ticket, human_resource, document.
(company, auth, location, notification, audit, automation allocate no codes.)

## 2. Polymorph references (Q3, Q29)

Use `<role>_type text NOT NULL` + `<role>_id text NOT NULL` (uuid stored as
text when targets mix id types; `uuid` when all targets are uuid) only when a
row points at exactly one of more than three target tables.

- CHECK on the `_type` vocabulary; composite index `(<role>_type, <role>_id)`.
- The owning service validates through a resolver map:
  `Record<PayableType, (id, tx) => Promise<Payable>>`, each entry an exported
  service of the target module.
- Polymorph tables in the target:

| Column pair | Vocabulary |
|---|---|
| `payment.payment_allocations.payable_*` | `sale_invoice`, `supplier_bill`, `employee_advance`, `expense_claim`, `expense_settlement`, `employee_salary_record` |
| `payment.payments.counterparty_*` (exists) | `customer`, `customer_company`, `supplier_company`, `employee`, `other` |
| `inventory.movements.reference_*` (exists) | `goods_receipt`, `delivery_note`, `sale_return`, `purchase_return`, `stock_adjustment`, `borrowing`, `maintenance`, `disposal`, `manual` |
| `finance.journal_entries.source_*`, `finance.cash_bank_transactions.source_*` (exist) | documented per module |
| `document.documents.source_*` (exists) | `<module>.<table>` keys |
| `notification.push_notifications.source_*` (exists) | free text, informational |

Not polymorph (relations set together or at most three targets):
`inventory.movements.product_id`/`item_id`, `inventory.documents.product_id`/`item_id`,
`ticket.tickets.customer_id`/`company_id`/`project_id`/`warranty_id`/`item_serial_id`,
`inventory.borrowings` borrower (user / customer / guest snapshot).

## 3. Addresses (Q10)

Every address table stores `address_line text`, `village_id uuid` (logical
reference to `location.villages.id`), `postal_code varchar(10)`, `label`,
`is_primary`, plus its owner id. No district/regency/province columns.
`ExportedLocationService.resolveVillagePath(villageIds[])` returns
village -> district -> regency -> province for display (batched, cached in the
location repositories already). Address tables: `company.addresses`,
`customer.addresses`, `customer.company_addresses`, `supplier.addresses`,
`supplier.company_addresses`, `inventory.warehouse_addresses`,
`project.addresses`, `human_resource.employee_addresses` (target).

## 4. Exported services and the dependency matrix

Arrows are "service in row calls exported service of column". `E` marks a
repository-only `Exported<X>Service` facade that exists to break a cycle.

| Caller \ Callee | location | user/org | company | customer | supplier | inventory | sale | procurement | finance | tax | payment | project | ticket | hr | document | notification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| company | x | x | | | | | | | | | | | | | | |
| customer | x | x (create portal login) | | | | | | | | | | | | | | x |
| supplier | x | x | | | | | | | | | | | | | | |
| inventory | x | x | x | x | | | | | | | | | | x | | x |
| sale | | x | x | x | | x | | | x | x | x | E (`ExportedLeadService`) | | | x | x |
| procurement | | x | x | | x | x | | | | | | | | | | x |
| finance | | x | x | x | x | x (depreciation, valuation) | E (`ExportedInvoiceService`) | E (`ExportedPurchaseOrderService`) | | x | E (`ExportedPaymentService`) | | | x | x | |
| tax | | x | x | | | | | | E (`ExportedJournalService`) | | | | | | x | |
| payment | | x | x | x | x | | E (invoices, receipts) | | E (bills, advances, accounts) | | | | | x | | x |
| project | x | x | x | x | | x | E (`ExportedOrderService`) | | | | | | | x | x | x |
| ticket | | x | x | x | | x | | | | | | x | | x | | x |
| human-resource | x | x | | | | | | | | | | | | | x | x |

Cycles broken by `E` facades (each depends only on its own repositories):

- **sale <-> project**: sale validates `lead_id` with `ExportedLeadService`
  (project); project reads the order with `ExportedOrderService` (sale).
- **finance <-> sale / procurement / payment**: finance posts journals for
  invoices, bills and payments it reads through `Exported*Service`; those
  modules call `FinancePostingService` (full service) to post.
- **payment <-> finance / sale**: payment resolves payables through exported
  facades; sale/finance call `PaymentService` only for creating payments.
- **tax <-> finance**: tax reads posted journals through
  `ExportedJournalService`; finance calls `TaxService` for rates.

Rule of thumb carried into every module file: a module that is called by many
(`customer`, `inventory`, `sale`, `finance`) publishes a repository-only
`Exported<Module>Service` with read/resolve/assert methods; its full service is
injected only by modules it never calls back.

## 5. URL layout (Q8, Q28, Q33, Q34)

| Kind | Shape | Example |
|---|---|---|
| Staff API | `/<prefix>/<resource>` | `/sales/quotations`, `/inventory/products` |
| Admin-only API | `/admin/<prefix>/<resource>` | `/admin/users`, `/admin/sales/code-numberings` |
| Self-service | unchanged | `/users/me*`, `/invitations/claim/:token`, `/username-availability` |
| Customer portal | `/customers/portal/v1/...` | `/customers/portal/v1/invoices` |
| Public (no session) | `/<prefix>/public/v1/...` *(open item)* | `/inventory/public/v1/catalog`, `/projects/public/v1/inquiries` |
| Machine API (API key) | `/<prefix>/api/v1/...` *(open item)* | `/projects/api/v1/licenses/validate` |
| Webhooks | `/<prefix>/webhooks/<provider>` *(open item)* | `/payments/webhooks/xendit`, `/automation/webhooks/whatsapp` |

Prefixes: `/users`, `/organizations`, `/locations`, `/companies`,
`/customers`, `/suppliers`, `/inventory`, `/sales`, `/procurement`
(`/purchase-orders` etc. become `/procurement/purchase-orders`), `/finance`,
`/taxes`, `/payments`, `/projects`, `/tickets`, `/human-resources`,
`/documents`, `/notifications`, `/audit`, `/automation`.

Aliases (Q34): only for callers outside this repository - payment gateway
webhooks, license API (`/licensing/v1/*`), website public API
(`/public/v1/*` used by web-landing builds already deployed and by n8n),
WhatsApp/n8n webhooks (`/integrations/whatsapp/*`). The alias is a second
mount of the same handler (POST bodies cannot rely on a 308 for every client),
tagged `deprecated` in OpenAPI, and listed in `99-cutover.md` with a removal
task. The three frontends in this repo are updated to the new URLs in step 6
and never use an alias.
