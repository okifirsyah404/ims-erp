# Database refactor: schema and table normalization (ERP-0070)

Status: **planned** (design grilled with the owner 2026-11-19; no code changed).
Branch: `refactor(db)/schema-and-table-normalization` (created from `main`
`929209c6`). Decision record: `docs/architecture/decisions/ADR-0024-database-normalization-baseline-v2.md`
(proposed).

This folder is the plan. It is split so a session can pick up one module
without reading the rest:

| File | Content |
|---|---|
| `00-overview.md` | this file: rules, decisions, phases, exit criteria |
| `01-target-schema.md` | final schema/table inventory and the old -> new table map |
| `02-shared-patterns.md` | `code_numberings`, polymorph references, addresses, exported services, URL layout |
| `modules/<module>.md` | one file per backend module, steps 1-6 for that module |
| `99-cutover.md` | baseline migration, seeders, URL aliases, verification, doc sync |

## Hard rules of this refactor

1. **No cross-schema foreign key** (`elysia-module` rule 3.2, ADR-0014). A link
   to another module is a plain nullable id column with the standard
   logical-reference note, validated by the owning module's
   `resolve*` / `assert*` contract or exported service.
2. **Polymorph only for "one of more than three".** When a row points at
   exactly one of more than three different target tables, the columns are
   `<role>_type` + `<role>_id` with a CHECK on the `_type` vocabulary
   (Q3, Q29). Relations that can be set together (e.g. a ticket's customer,
   project and serial) stay separate columns even if there are more than three.
3. **One repository per table.** A repository may join tables of its own
   schema; it never imports another module's schema file.
4. **One module per Postgres schema.** The only exception is `auth`, shared by
   the `user` and `organization` modules because Better Auth owns it
   (`elysia-module` rule 3.3, Q9).
5. **Cross-module calls are service to service** through the owner's DI token.
   Cycles are broken with repository-only `Exported<X>Service` facades
   (`elysia-module` rule 3.5). See `02-shared-patterns.md` for the matrix.
6. Unchanged project rules still apply: unix-ms `bigint` datetimes, integer IDR
   minor-unit money, `deleted_at` soft delete, text + CHECK status
   vocabularies, English code/docs, en+id locale parity.

## Decisions (grill session 2026-11-19)

| # | Decision |
|---|---|
| Q1 | Scope is per schema: the owner's list is the target for the schemas it names; `audit` and `automation` stay; target-only schemas `payroll`, `approval`, `budgeting`, `investor`, `commerce` are removed from `docs.dbml`. |
| Q2 | **Squash to a new baseline** (no production database exists - ADR-0011/0018/0019). Old migrations are archived; one baseline per schema is generated at the end. Recorded in ADR-0024. |
| Q3 | Polymorph rule = "one of more than three targets". |
| Q4 | `organization.*` is removed. `organization.settings` + the planned `fiscal_settings` become `auth.organization_settings`. Branches/departments/positions/cost centres were never built and are dropped. |
| Q5 | `auth.portal_identities` is replaced by `customer.customers.user_id` + portal role/status. Unbuilt auth extensions (`user_profiles`, `user_preferences`, `identity_verifications`, `user_devices`) are dropped. |
| Q6 | Document numbering moves to one `<schema>.code_numberings` table per schema that allocates codes. `code_number` schema and module are removed. |
| Q7 | Plan layout = this folder. |
| Q8 / Q33 | Module folders follow the schema name. URLs use the **plural module prefix** (`/customers`, `/sales`, `/projects`, `/human-resources`; `/inventory` and `/finance` stay singular). |
| Q9 | `user` and `organization` stay two modules on the shared `auth` schema. Module `portal` is deleted. |
| Q10 | Addresses store only `village_id`; district/regency/province are derived through `ExportedLocationService`. |
| Q11 | Licensing moves to `project.license_*` (all 6 built tables, API kept). |
| Q12 | Leads move to `project.leads` / `lead_activities` / `lead_attachments` (one customer, many leads and projects). |
| Q13 | Added beyond the owner's list: `ticket.ticket_messages`, `project.warranties`. |
| Q14 | Inventory option (a): `products` = stocked/sold SKU (was `inventory.items`), `items` = tool/asset, one row per physical unit (was `assets.assets`), `item_serials` = serial units of products (was `serial_tracked_items`). |
| Q15 | `asset_movements` merge into `inventory.movements`; `borrowing_lines` -> `inventory.borrowing_items`; `asset_documents` -> `inventory.documents`; `asset_types` -> `items.item_kind`; `asset_depreciations` -> `finance.asset_depreciations`; `tool_sets` dropped. |
| Q16 | `customer.companies` = B2B entity; `customer.customers` = a person (individual or company PIC, `company_id` and `user_id` nullable). `crm.customer_contacts` merges into `customers`. |
| Q17 | Same split for suppliers: `supplier.companies` + `supplier.suppliers` (PIC). |
| Q18 | `payment.payment_allocations` kept with polymorph `payable_type`/`payable_id` (staged settlement). `gateway_payments` merges into `payment.payments` (`channel`, `gateway_id`). `payment.gateways` holds AES-256-GCM-encrypted secrets, write-only API. |
| Q19 | `accounting.*` -> `finance.*` except tax tables -> `tax.taxes/records/corrections/withholding_tax_records`. `accounting_settings` -> `finance.settings`; `hr.salary_summaries` -> `finance.employee_salary_records`; `hr.bank_accounts` -> columns of `finance.employee_salaries`; `company.bank_accounts` -> `finance.cash_bank_accounts`. |
| Q20 | `human_resource` keeps `leave_types` and `employee_tasks`; `schedules` = per-employee work shift per date. |
| Q21 | `audit`, `automation` (built tables), `company` kept; `company.head_office_addresses` -> `company.addresses`. |
| Q22 | Unbuilt target tables are defined in `docs.dbml` only (`status: target`); steps 2-6 cover built tables. |
| Q23 | Lead flow: lead (optional `customer_id`) -> won creates customer via `ExportedCustomerService` -> `sale.quotations.lead_id` -> project from order with `lead_id`. |
| Q24 | One `inventory.movements` with `product_id` / `item_id`, exactly one set. |
| Q25 | `inventory.documents` stores its own files, `product_id` / `item_id` exactly one set. |
| Q26 | `borrowing_requests` (request + approval) produce at most one `borrowings` (issue/return). |
| Q27 | `inventory.settings` = module config; `warehouse_settings` = per-warehouse config. |
| Q28 | Portal routes move to the `customer` module under `/customers/portal/*`. |
| Q29 | Ticket templates spawn sub-tickets; ticket relations are separate columns (not polymorph). |
| Q30 / Q35 | One long branch, phase per module, each phase green before the next. |
| Q31 | Folder `human-resource`; ADR-0024; epic ERP-0070..ERP-0088; existing `organization_id` scope kept per table. |
| Q32 | `notification.push_notifications` / `push_notification_templates`; `document` gains `settings` + `code_numberings`. |
| Q34 | External endpoints (gateway webhooks, license API, website RFQ/catalog, WhatsApp/n8n webhooks) move to the new URLs and keep the old URL as an alias during a transition window. |

### Open items (not grilled; confirm in review before the phase that needs them)

- **Public / machine URL shape.** Proposed in `02-shared-patterns.md` §5:
  `/<prefix>/public/v1/...`, `/<prefix>/api/v1/...`, `/<prefix>/webhooks/<provider>`.
- **Other uncountable prefixes.** Q33 exempted `/inventory` and `/finance`;
  the plan applies the same exemption to `/procurement`, `/audit` and
  `/automation`. Confirm or switch to strict plurals.
- **`procurement` and `tax` settings tables.** The owner's list has none; the
  plan adds only `code_numberings` to them. Add `settings` only when a setting
  appears.
- **Salary screens' menu.** Salary data moves to finance (Q19); whether the
  screens sit in the Finance or the HR menu is a UI choice for review
  (`modules/finance.md` step 6).
- **`payment.payments` direct payable columns.** With allocations carrying
  every payable (Q18), the plan removes `sales_invoice_id`,
  `supplier_bill_id`, `employee_advance_id` from `payments`.
- **`item_serials` naming.** Per Q14(a) it holds serial units of *products*;
  the column is `product_id`. Renaming to `product_serials` would read better
  but deviates from the owner's list - left as named.

## Six steps per module

Every module file follows the owner's order:

1. Update `docs/database/docs.dbml` (canonical; edit before Drizzle), then run
   `bun docs/database/gen-logical-references.ts` and
   `bun docs/database/validate-dbml.ts` (must print `OK`).
2. Update `apps/backend/drizzle/schemas/<schema>.schema.ts`.
3. Update repositories (one per table).
4. Update services; cross-module through exported services.
5. Update controllers (new URL prefix, alias where Q34 applies).
6. Update consumers: `apps/web-admin`, `apps/web-landing`,
   `apps/web-customer-portal` (+ locales en/id when copy changes).

Steps 1-2 for **all** modules may be done first (the schema is one coherent
contract); steps 3-6 then go module by module in the phase order below.

## Phase order

Dependencies point downward; a phase may only start when the previous one is
green (`bun run lint`, `bun run test`, `bun run typecheck`).

| Phase | Modules | Backlog |
|---|---|---|
| P0 | ADR-0024, shared numbering helper, `docs.dbml` rewrite, Drizzle schema files | ERP-0070 |
| P1 | location, auth (user + organization), company | ERP-0071..0073 |
| P2 | customer, supplier | ERP-0074..0075 |
| P3 | inventory | ERP-0076 |
| P4 | sale, procurement | ERP-0077..0078 |
| P5 | finance, tax, payment | ERP-0079..0081 |
| P6 | project, ticket, human-resource | ERP-0082..0084 |
| P7 | document, notification, audit + automation | ERP-0085..0087 |
| P8 | cutover: baseline migrations, seeders, aliases, docs | ERP-0088 |

Between phases the app does not run against a database (the schema is being
rebuilt); unit tests with mocked repositories carry the verification until P8
produces the baseline and the seed.

## Modules removed

`accounting`, `aftersales`, `assets`, `catalog`, `code-number`, `crm`,
`licensing`, `portal` (backend folders), and the Postgres schemas
`accounting`, `aftersales`, `assets`, `catalog`, `code_number`, `crm`,
`licensing`, `organization`, `payroll`, `approval`, `budgeting`, `investor`,
`commerce`. Deleting a module also removes its container registration, its
`app.ts` mount, its locale keys and any orphan logical reference
(AGENTS.md Definition of Done item 10).

## Pre-existing boundary violations fixed by this plan

- `accounting` owns `finance.*` tables through 7 repositories (`ap-open-item`,
  `ar-open-item`, `bank-reconciliation`, `cash-bank`, `close-checklist`,
  `supplier-bill-item`, `supplier-bill`) -> resolved by the `finance` module.
- `organization/repositories/organization.repository.ts:8` imports the
  `inventory` schema -> replaced by `ExportedWarehouseService`.
- `user` reads `portal.schema.ts` (`portal_identities`) -> table removed;
  portal identity lives in `customer.customers`.

## Exit criteria of the epic

- `docs.dbml` describes exactly the schemas in `01-target-schema.md`;
  `validate-dbml.ts` prints `OK`.
- Every built table has one Drizzle definition and one repository; no
  repository imports another module's schema file (grep check in
  `99-cutover.md`).
- Baseline migrations apply to an empty database; `drizzle:generate` reports no
  diff; `drizzle:seed` is idempotent (run twice).
- `bun run lint`, `bun run test`, `bun run typecheck` green across the
  workspace; locale parity and dead-key tests green.
- The three frontends call only new URLs; aliases exist only for the Q34
  external endpoints.
- `progress.md`, `backlog.md`, `features.md`, `docs/architecture/*` module docs
  and `docs/database/*` reflect the result.
