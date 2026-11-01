# Implementation Phases

Companion to `docs.dbml` (canonical). How the target schema gets built from
the current database, in what order, and what proves each step is done.

Nothing in this document has been applied to a database. Every command is
labelled **verified** (executed in this repo, outcome recorded) or
**proposed** (must be run and recorded before the step counts as done).

## The starting point

The database today has three schemas and 16 tables.

| Schema | Tables | Origin |
|---|---|---|
| `auth` | 9 | Better Auth, migration `20261028042701_create_auth_schema` |
| `location` | 4 | migration `20261028042750_create_location_schema`, seeded from `database/seeders/raw/location/*.json` |
| `sales` | 2 | migration `20261029044823_dear_living_lightning` (transitional scaffold) |

The target is 24 schemas, 251 tables.

## The gap between the two

| Item | Target | Where it lands |
|---|---|---|
| `erp` schema (`audit_logs`, `customers`, `investors`) | **does not exist in any migration** | never created. `audit.audit_logs`, `crm.customers`, `investor.investors` replace it (step S1) |
| `sales.payments` (`amount integer`) | transitional scaffold, overflows above ~Rp 21.4 million | dropped in step S7, replaced by `finance.payments` |
| `sales.quotations` (`text` id, single `amount integer`) | transitional scaffold | replaced by the target quotation model in step S3 |
| `location.*` (`text` id, `updated_at` nullable) | matches the target shape | aligned in step S2, no table recreation |
| `auth.*` | Better Auth managed | never hand-edited |

## Ground rules for every step

1. **Migrations are append-only.** Historical migrations and their snapshots
   stay untouched. A new step adds a new migration.
2. **Generate, read, then apply.** `bunx drizzle-kit generate` writes the SQL;
   a human reads it before it touches a database.
3. **Disposable database first.** Every step is applied to a throwaway
   PostgreSQL 18 database before it is applied to the real one.
4. **Never migrate a production database by hand.** `drizzle-kit push` is for
   disposable databases only.
5. **`docs.dbml` is canonical.** The Drizzle schema files are hand written
   from it, module by module. No DBML-to-SQL generator is used. When the
   Drizzle file and `docs.dbml` disagree, `docs.dbml` wins and the Drizzle
   file is the bug.
6. **One module per migration.** A step that creates 12 tables creates them in
   one module schema. Cross-module ordering does not matter because no
   cross-module foreign key exists.
7. **No secrets printed.** Connection strings and tokens are never written to
   a log, a doc or a migration.
8. **Seed twice.** Every seeder must run twice without error.

## Commands

| Command | Where | Status |
|---|---|---|
| `bunx --bun drizzle-kit generate` | `apps/backend` | verified 2026-10-29, produced the append-only sales migration |
| `bunx --bun drizzle-kit migrate` | `apps/backend` | verified 2026-10-29, applied to the dev database |
| `bun run drizzle:seed` | `apps/backend` | verified 2026-10-29, idempotent on the second run |
| `bunx --bun drizzle-kit push` | `apps/backend` | proposed, disposable databases only |
| `bun run typecheck` / `bun run lint` / `bun test` | `apps/backend` | verified 2026-10-29 |
| `bun run drizzle:migrate-reset` | `apps/backend` | proposed, destructive, disposable databases only |

The `--bun` flag is required: the Drizzle driver is `drizzle-orm/bun-sql` and
drizzle-kit otherwise resolves no DB driver and exits with
`please install either of 'pg', 'postgres', 'bun'...`.

---

## S1 — Foundations: audit, identity, organization

**Why first.** Every other module needs the organization key, the actor key and the
organization structure. `audit` is first because it is the only module with
no dependency on anything.

**Schemas created.** `audit`, `auth` (extension tables), `organization`.

| Schema | Tables | Note |
|---|---|---|
| `audit` | 1 | `audit.audit_logs`. Append-only, `organization_id` nullable |
| `auth` | 6 | the ERP extension tables: `user_profiles`, `user_role_assignments`, `portal_identities`, `user_preferences`, `identity_verifications`, `user_devices` (the 9 Better Auth core tables already exist from the auth setup) |
| `organization` | 9 | `company_profiles`, `branches`, `departments`, `positions`, `cost_centers`, `company_bank_accounts`, `fiscal_settings`, `document_sequences`, `company_settings` |

**Explicitly not created.** The `erp` schema. `architecture.md` and
`data-model.md` still describe it; that text is stale and is corrected by
this step. Nothing migrates out of `erp` because nothing was ever in it.

**Drizzle files.**

```
apps/backend/drizzle/schemas/audit.schema.ts        (new)
apps/backend/drizzle/schemas/identity.schema.ts      (new — the 6 ERP extension tables in pgSchema('auth'); the 9 Better Auth core tables come from the auth schema map, not from this file)
apps/backend/drizzle/schemas/organization.schema.ts  (new)
```

The Identity module owns a single `auth` schema: Better Auth's 9 core tables
(generated from the adapter table map) plus the 6 ERP extension tables
(`user_profiles`, `user_role_assignments`, `portal_identities`,
`user_preferences`, `identity_verifications`, `user_devices`) declared in
`identity.schema.ts` under `pgSchema('auth')`. No cross-schema FK exists
anywhere; every other module references `auth.users.id` /
`auth.organizations.id` logically.

**Column rules that apply here.**

- `id uuid [pk, default: uuidv7()]` — PostgreSQL 18 native, time ordered.
- `organization_id text NOT NULL`, logical reference to `auth.organizations.id`.
- `created_at` / `updated_at` `bigint NOT NULL`, unix milliseconds.
- `deleted_at bigint` nullable on every master table.
- No native enum. Status columns are `text` with a `Checks` block.

**Work.**

1. Write the three Drizzle schema files from the matching `TableGroup` in
   `docs.dbml`.
2. `bunx --bun drizzle-kit generate` — read the generated SQL line by line.
3. Apply to a disposable database. Check that every `Checks` block became a
   `CHECK` constraint and every `uuidv7()` default survived.
4. Write `audit.audit_logs` as an append-only table: no `deleted_at`, no
   `updated_at`.
5. Seed: none yet beyond the organization(s). A `organization.company_profiles`
   row per organization is the seed of every other module. Multiple
   organizations may exist inside the one company (ADR-0007); the
   development seeder is skipped in production, where organizations are
   created through the API by an application admin.

**Tests.** Every table in the step: `id` default is a uuidv7, `organization_id`
is required, the `CHECK` rejects an unknown status value, a soft delete sets
`deleted_at` and hides the row from a default list.

**Exit criteria.**

- [ ] Three schemas exist, 16 tables, no `erp` schema anywhere.
- [ ] The migration was applied to a disposable database and inspected.
- [ ] `bun run typecheck`, `bun run lint`, `bun test` pass.
- [ ] `architecture.md` and `data-model.md` no longer mention `erp` as a
      current schema.

---

## S2 — Master data: location, CRM, catalog, HR, procurement, inventory

**Schemas.** `location` (aligned), `crm`, `catalog`, `hr`, `procurement`,
`warehouse`, `inventory`.

| Schema | Tables | Note |
|---|---|---|
| `location` | 4 | already exists, aligned to the target shape |
| `crm` | 10 | customer master, groups, contacts, addresses, leads, segments, credit limits |
| `catalog` | 12 | unified goods and service master, units, prices, bundles |
| `hr` | 16 | employee master, contracts, attendance, leave, training, bank accounts |
| `procurement` | 11 | suppliers, purchase requests, orders, receipts, returns |
| `warehouse` | 3 | warehouses, zones, bins — the physical structure of the Inventory module |
| `inventory` | 11 | stock movements (truth), stock balances (projection), adjustments, transfers, reservations, serial/lot, cycle counts |

The Inventory module spans `warehouse` and `inventory`. The split is storage
grouping, not an ownership boundary: `inventory.*` tables carry real foreign
keys into `warehouse.warehouses` and `warehouse.warehouse_bins`, so the
Drizzle files must be generated and migrated **in the same step**, warehouse
first.

**Location alignment.** The four tables already exist with the right shape.
The only change is a `location` module contract (`resolveLocation`) and the
id type check. **No table recreation.** The `location` codes stay globally
unique, not partial, because the code is the real administrative code.

**Drizzle files.**

```
apps/backend/drizzle/schemas/crm.schema.ts          (new)
apps/backend/drizzle/schemas/catalog.schema.ts       (new)
apps/backend/drizzle/schemas/hr.schema.ts            (new, replaces the empty employee.schema.ts stub)
apps/backend/drizzle/schemas/procurement.schema.ts   (new)
apps/backend/drizzle/schemas/warehouse.schema.ts     (new, replaces the empty warehouse.schema.ts stub; warehouse structure)
apps/backend/drizzle/schemas/inventory.schema.ts     (new, replaces the empty inventory.schema.ts stub; stock ledger)
```

The empty stub files `employee.schema.ts`, `inventory.schema.ts`,
`project.schema.ts`, `document.schema.ts` and `warehouse.schema.ts` are
placeholders. Fill or delete them, do not leave a half-named schema behind.

**One table, one owner.**

- `catalog.items` is the **only** goods and service master, discriminated by
  `item_type` (`good | service | bundle | subscription`). No parallel
  `products` and `services` tables.
- `crm.customer_addresses` replaces a separate billing and shipping pair. One
  table, one `kind` discriminator.
- `inventory.stock_movements` is the authoritative ledger.
  `inventory.stock_balances` is a projection and is never the source of truth.
- `procurement.suppliers` owns the vendor master. Supplier bills and their
  payment live in Finance (S4), not here.
- HR holds the employment record. Payroll (S5) holds a copy of the
  payroll-relevant attributes.

**Cross-module links in this step** are all logical. `crm.customers.customer_id`
is a logical reference to `auth.users.id`; `inventory.stock_movements.item_id`
is a logical reference to `catalog.items.id`. No foreign key, no join.

**Work.**

1. Write the five schema files.
2. Generate one migration per schema, so a failure names one module.
3. Apply to a disposable database. Check the seeded location rows still load
   and the new `crm.customer_addresses` table accepts both `kind` values.
4. Seed: location (existing, idempotent), units, item categories, one
   warehouse, one employee, one supplier per organization.

**Tests.**

- A code can be reused after a soft delete, but not twice while both rows are
  alive. The partial unique index is the proof, and it is applied in S7.
- A `catalog.items` row of `item_type = 'service'` has no stock rows.
- A soft-deleted employee disappears from a default list and stays readable
  through a history read.
- Cross-tenant read: a row of organization A is invisible to organization B.

**Exit criteria.**

- [ ] Seven schemas aligned, 67 tables in place.
- [ ] The four location tables are **not** recreated; their seed still passes.
- [ ] Every cross-module link is a plain id column with the standard note
      wording, verified by parsing `docs.dbml`.
- [ ] Seeds run twice without error.

---

## S3 — Sales: the target quotation model

**Why this step exists.** The live `sales.quotations` table is a scaffold:
`id text`, one `amount integer`, no items, no customer, no status history.
It cannot become the target model with `ALTER TABLE`, because the id type
changes and the table gains roughly twenty columns and two child tables.

**The move.** Recreate the table, not alter it.

| Before | After |
|---|---|
| `sales.quotations` scaffold, `text` id, `amount integer` | `sales.quotations` target, `uuid` id, `bigint` money, no `amount` |

**Schemas.** `sales`.

| Schema | Tables | Note |
|---|---|---|
| `sales` | 12 | 11 new + `sales.payments` (still transitional at this point, dropped in S7) |

New tables: `quotation_items`, `quotation_status_history`, `sales_orders`,
`sales_order_items`, `order_status_history`, `contracts`,
`discount_requests`, `sales_returns`, `delivery_notes`, `sales_targets`.

**Recreation procedure.**

1. Check the table is empty. If it holds rows, they are dev data: export them
   to a JSON file, then re-enter them by hand into the target shape. There is
   no automated path, because the scaffold has no line items and no customer.
2. `DROP TABLE sales.quotations` and create the target table in the same
   migration. A single migration means the table is never missing.
3. The existing index `quotations_org_code_uq` is recreated as a **plain**
   unique index. It becomes partial in S7.
4. `sales.payments.quotation_id` is `text` and points at a `text` id. After
   the recreation the column has no valid target. The table is transitional
   anyway, so it is emptied in the same migration and dropped in S7. Nothing
   is migrated into it.

**Rules that apply.**

- `discount_requests` points at **exactly one** of `quotation_id` or
  `sales_order_id`. The `CHECK` enforces it.
- A quotation total is the sum of its items. The service recomputes it on
  every write; the stored total is a cache, the items are the truth.
- `quotation_status_history` and `order_status_history` are append-only
  history tables, no `deleted_at`.
- `sales.sales_orders.customer_id` is a logical reference to `crm.customers.id`.

**Work.**

1. Write `sales.schema.ts` from the target `TableGroup` in `docs.dbml`.
2. Delete the scaffold definition from the current `sales.schema.ts`.
3. Generate the migration, read the `DROP` and the `CREATE`, apply to a
   disposable database.
4. Update the Sales service and repository to the target columns. The
   repository currently maps `amount integer`; it now maps `subtotal`,
   `discount_amount`, `tax_amount`, `grand_total` as `bigint`.
5. The Sales controller keeps its shape: list, detail, create, submit,
   approve, reject.

**Tests.**

- A quotation with two items stores a total equal to the sum of the lines.
- Self approval is rejected (already implemented, must keep passing after
  the column change).
- A quotation of another organization is invisible and cannot be approved.
- The discount request `CHECK` rejects a row with both parents, and a row
  with neither.
- A quotation in a non-draft status cannot be edited.

**Exit criteria.**

- [ ] `sales.quotations` has the target shape, `uuid` id, `bigint` money.
- [ ] `sales.payments` is empty and still exists (dropped only in S7).
- [ ] No `amount integer` money column survives anywhere in `sales`.
- [ ] The Sales HTTP flow still works end to end.

---

## S4 — Money: finance and accounting

**The single ledger rule.** `finance.payments` is the **only** table in the
ERP that records a money movement. `finance.receipts` is a customer facing
proof, `finance.credit_memos` is a credit note, `finance.cash_bank_transactions`
is a movement on an operational account, `payroll.payroll_payments` is a
payroll batch. None of them is a second payment ledger.

**Schemas.**

| Schema | Tables |
|---|---|
| `finance` | 17 |
| `accounting` | 12 |

Finance: `invoices`, `invoice_items`, `payments`, `payment_allocations`,
`payment_terms`, `receipts`, `credit_memos`, `supplier_bills`,
`employee_advances`, `expense_claims`, `expense_claim_items`,
`expense_settlements`, `expense_settlement_items`, `cash_bank_accounts`,
`cash_bank_transactions`, `bank_reconciliations`,
`bank_reconciliation_items`.

Accounting: `chart_of_accounts`, `journal_entries`, `journal_lines`,
`accounting_periods`, `accounting_settings`, `opening_balances`,
`account_balances`, `tax_types`, `tax_records`, `withholding_tax_records`,
`journal_templates`, `bank_account_links`.

**Money columns.** `bigint`, exact IDR minor units, with a `currency_code
varchar(3) NOT NULL DEFAULT 'IDR'` next to them. Never a float (ADR-0002).
A `bigint` holds up to Rp 92 quadrillion in minor units; the `integer` in
the old `sales.payments.amount` overflowed at Rp 21.4 million.

**Rules that apply.**

- `accounting.journal_entries`: `total_debit = total_credit`, enforced by a
  `CHECK`. The service posts the entry in one transaction.
- `accounting.journal_lines`: exactly one positive side.
  `(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)`.
- A posted journal entry is never edited. A correction is a reversing entry
  through `reversed_by_entry_id`.
- `finance.payment_allocations` is the instalment link between a payment and
  an invoice. Unique on `(payment_id, invoice_id)`.
- `finance.employee_advances` and `finance.expense_settlements` are the only
  advance and settlement ledgers. A disbursement is a `finance.payments` row
  that points at the advance.
- `accounting.chart_of_accounts` is hierarchical and self referencing. Only
  postable accounts accept a journal line.

**Cross-module links.** `finance.invoices.customer_id` →
`crm.customers.id` (logical). `finance.invoices.sales_order_id` →
`sales.sales_orders.id` (logical). `accounting.journal_lines.project_id` →
`projects.projects.id` (logical, the module does not exist yet, the column
still does). `finance.payments.approved_by` → `auth.users.id` (logical).

**Work.**

1. Write `finance.schema.ts` and `accounting.schema.ts`.
2. Generate one migration per schema.
3. Apply to a disposable database. Check the money `CHECK` constraints.
4. Seed: chart of accounts (the standard Indonesian chart for an access
   control business), one cash/bank account, payment terms, one accounting
   period.

**Tests.**

- A journal entry with unequal debit and credit is rejected by the database.
- A journal line with both sides positive is rejected.
- A payment of Rp 25.000.000 is stored exactly, with no rounding error.
- A payment allocation of the same payment to the same invoice twice is
  rejected.
- An invoice of another organization is invisible.
- A receipt of another organization is invisible.
- A payment execution without a prior approval is rejected.

**Exit criteria.**

- [ ] 29 tables created, no `amount integer` money column anywhere in
      `finance` or `accounting`.
- [ ] Exactly one payment ledger exists: `finance.payments`.
- [ ] The `CHECK` constraints are present in the database, not only in the
      service.

---

## S5 — Operations: projects, after-sales, assets, payroll

**Schemas.**

| Schema | Tables | Note |
|---|---|---|
| `projects` | 13 | zero intra-module foreign keys by design |
| `aftersales` | 15 | zero intra-module foreign keys by design |
| `assets` | 11 | depreciation writes a journal entry through a logical reference |
| `payroll` | 11 | payslip lines are a snapshot |

**Two modules with zero foreign keys.** `projects` and `aftersales` validate
their own hierarchy in the service. Every internal link is a plain id column
on `projects.projects.id` or `aftersales.service_tickets.id`. This keeps both
modules easy to seed and to extend, and it is deliberate, not an oversight.

**Rules that apply.**

- `payroll.payslip_items` is a **snapshot** of the salary component at
  calculation time. A later change to `payroll.salary_components` never
  rewrites a historical payslip.
- `payroll.payroll_periods` is unique on
  `(organization_id, period_year, period_month)`.
- `assets.asset_depreciations` references `accounting.journal_entries.id`
  logically, not by foreign key. The accounting module posts the entry, the
  assets module records the link.
- `projects.project_handover` is the BAST. It points at the customer, the
  project, the sales order and the document, all logically.
- `aftersales.spare_parts` is the after-sales reference list. The stock truth
  is in `inventory.stock_movements`.
- `projects.project_kpi_evaluations.employee_id` is a logical reference to
  `hr.employees.id`.

**Work.**

1. Write the four schema files.
2. Generate one migration per schema.
3. Apply to a disposable database.
4. Seed: project types, SLA policies, warranty policies, asset categories,
   salary components.

**Tests.**

- A payslip issued in month 1 is unchanged after a salary component changes
  in month 2.
- Two payroll runs for the same period cannot both be open.
- A handover of another organization's project is rejected.
- A depreciation of an asset that is already disposed is rejected.
- A project task whose parent task is in another project is rejected (the
  service check, since there is no foreign key).

**Exit criteria.**

- [ ] 50 tables created.
- [ ] `projects` and `aftersales` still have zero foreign keys. Verified by
      parsing `docs.dbml`, not by memory.
- [ ] The payslip snapshot test passes.

---

## S6 - Support modules: documents, approval, budgeting, investor, commerce, automation, licensing, ticketing

**Schemas.**

| Schema | Tables | Note |
|---|---|---|
| `documents` | 8 | document master, files, signatures, access logs, shares, tags |
| `approval` | 7 | policies, immutable versions, requests, stages, decisions, delegations, thresholds |
| `budgeting` | 8 | periods, budgets, items, revisions, executions, cash flow |
| `investor` | 11 | investors, commitments, deposits, allocations, profit sharing |
| `commerce` | 9 | public web pages, menus, catalog publications, promotions, shop orders |
| `automation` | 11 | integrations, encrypted credentials, workflows, scheduled jobs, outbox, notifications |
| `licensing` | 9 | applications, packages, contracts, keys, activations, entitlements, subscriptions |
| `ticket` | 5 | customer issue tickets: categories, tickets, messages, attachments, status history |

**Approval is the load-bearing module.** Every module that needs an approval
calls the Approval contract instead of inventing its own columns. The rules:

- A policy **version** is immutable. A change creates a new version. An
  approval request always points at the version that was in force.
- A decision log is append-only. No `deleted_at` on
  `approval.approval_decisions`.
- A duplicate decision on the same stage is rejected, by a unique index on
  `(approval_stage_id, approver_user_id)`.
- Self approval is blocked by `no_self_approval boolean NOT NULL DEFAULT true`
  on `approval.approval_policy_versions`, enforced by the service.
- A stage opens only when the previous stage is finished. The order is
  `stage_order`.
- The amount must fall inside the band of the stage
  (`min_amount` / `max_amount`).
- A change of the source document invalidates the request. The request stores
  `source_version`, compared by the owning module on write.

**Automation secrets.** `automation.integration_credentials.secret_value_encrypted`
is the only place a secret is stored. It carries a key version and a rotation
date. No read endpoint returns the plain value.

**Commerce is not Sales.** A `commerce.commerce_orders` row is a public shop
order. The confirmed customer order is `sales.sales_orders`. The two are
different tables in different modules.

**Investor money.** The cash movement of a capital deposit is a
`finance.payments` row. `investor.capital_deposits` holds the investor side
and points at the transaction logically.

**Licensing.** One key can be activated several times, each activation on one
device. `license_entitlement_usages` records the consumption and is checked
before an activation.

**Work.**

1. Write the seven schema files.
2. Generate one migration per schema.
3. Apply to a disposable database.
4. Seed: document templates, approval policies for the first modules, budget
   periods, one investor, one license package.

**Tests.**

- A policy version cannot be updated. The trigger from S7 blocks it; until
  then the service blocks it.
- Two decisions by the same approver on the same stage are rejected.
- An approval request whose source document changed is rejected.
- A credential read never returns the plain secret.
- A license activation beyond the entitlement limit is rejected.
- A profit share satisfies `net_amount = gross_amount - tax_amount`.

**Exit criteria.**

- [ ] 68 tables created.
- [ ] Every approval flow in the ERP goes through the Approval module. No
      module keeps its own `approval_status` columns.
- [ ] No secret is readable through any endpoint.
- [ ] Ticketing: a portal customer can create a ticket and see only its own
      organization's tickets; internal notes never appear in a portal
      response (service-layer test).

---

## S7 - Constraints, triggers and the legacy retirement

**Why last.** The composite tenant foreign keys reference parent tables in
the same module. They can only be added once every table exists.

**Where the constraints live.** There is no separate constraints file. The
constraints are declared where every other table fact lives: the Drizzle
schema files of S1 to S6, applied through the normal drizzle-kit migration
flow. Exactly one hand-written SQL migration is added in this step, for the
things Drizzle cannot express.

**Constraint inventory (the spec the Drizzle schemas must satisfy).**

| Part | Content | Count |
|---|---|---|
| 1 | `UNIQUE (organization_id, id)` on every table that is the target of an intra-module foreign key | 85 |
| 2 | composite tenant foreign keys `(organization_id, parent_id) -> parent (organization_id, id)` | 197 |
| 3 | partial unique indexes `WHERE deleted_at IS NULL` for the reusable codes | 45 |
| 4 | triggers: `updated_at` maintenance, hard delete block, append-only rows | 3 functions, 9 append-only tables |
| 5 | `DROP TABLE IF EXISTS sales.payments` | 1 |

Parts 1-3 are written in the schema files: paired `unique(...)` constraints
for part 1,
`foreignKey({ columns: [t.organization_id, t.parentId], foreignColumns: [...] })`
for part 2, and
`uniqueIndex(...).where(sql\`deleted_at IS NULL\`)` for part 3. Part 4
triggers and the part 5 drop go into one custom SQL migration
(`drizzle/XXXX_constraints_and_legacy.sql`), because triggers are outside
drizzle-kit's vocabulary.

**Part 3 exclusions, on purpose.**

- `location.provinces`, `regencies`, `districts`, `villages`: the code is the
  real administrative code and identifies the same area forever.
- `organization.company_profiles.organization_id`: one profile per organization, a 1:1
  slot.
- Every table without a `deleted_at`: the row is never deleted, so a partial
  index would be pointless.

**Part 4 triggers.**

- `public.erp_set_updated_at()` keeps `updated_at` in unix milliseconds.
- `public.erp_prevent_hard_delete()` rejects a `DELETE` on a table that has a
  `deleted_at` column. Feature code sets `deleted_at` instead.
  `DROP SCHEMA ... CASCADE` and `TRUNCATE` are not blocked, so a disposable
  database can still be reset.
- `public.erp_prevent_row_mutation()` makes the history tables append-only:
  `audit.audit_logs`, `approval.approval_decisions`,
  `approval.approval_policy_versions`, `assets.asset_depreciations`,
  `documents.document_access_logs`, `licensing.license_events`,
  `sales.order_status_history`, `sales.quotation_status_history`,
  `ticket.ticket_status_history`.

  Deliberately **not** append-only: `accounting.journal_lines` (a draft
  entry is still editable), `inventory.stock_movements` and
  `automation.outbox_messages` (their status moves forward). For those the
  rule is "a posted row is never edited, a correction is a compensating row",
  which needs the row state, so it stays a service rule.

**Part 5, the legacy retirement.** `sales.payments` is dropped. It was the
transitional scaffold, its `amount` was an `integer` that overflowed above
about Rp 21.4 million, and `finance.payments` (S4) is the single payment
ledger.

**MATCH SIMPLE note.** The composite foreign keys use the default
`MATCH SIMPLE`: when the child column is `NULL`, the constraint is satisfied
without a check. That is the intended behaviour for an optional link. The
constraint only bites once `organization_id` is `NOT NULL` and the parent id
is `NOT NULL`, which is the case for every tenant-scoped table.

**Work.**

1. The constraint-bearing schema code of S1 to S6 is reviewed against the
   inventory above (85 / 197 / 45), counted by grepping the generated
   migration SQL, not by memory.
2. Apply the migrations plus the custom trigger/legacy migration to a
   disposable database that holds seed data across **two** organizations.
   This is the test that matters: it proves the composite foreign keys accept
   same-tenant rows and would reject a cross-tenant row.
3. Run the verification queries (kept below in the tests section).
4. Then apply to the real database through the normal migration flow.

**Verification queries (ad hoc, not a file).**

- Composite tenant foreign keys: count `pg_constraint` rows of contype
  `f` with two key columns whose target matches `(organization_id, id)` —
  expected exactly 197.
- Cross-module foreign keys: join `pg_constraint` to the target table's
  schema; expected 0 outside the documented `inventory <-> warehouse`
  exception.
- `sales.payments`: `to_regclass('sales.payments')` is `NULL`.

**Tests.**

- A row of organization A cannot reference a row of organization B. The insert
  is rejected by the composite foreign key.
- `DELETE FROM crm.customers WHERE id = ...` raises `restrict_violation`.
- `UPDATE audit.audit_logs SET action = ...` raises `restrict_violation`.
- A code can be reused after a soft delete, but not twice while both rows are
  alive.
- `to_regclass('sales.payments')` is `NULL`.
- The composite-tenant-FK verification query returns exactly 197.

**Exit criteria.**

- [ ] The constraint inventory (85 / 197 / 45) matches the generated
      migration SQL, verified by count.
- [ ] The verification queries all return the expected values.
- [ ] `sales.payments` no longer exists.
- [ ] No cross-schema foreign key exists except the documented
      `inventory <-> warehouse` exception. The cross-module query returns 0.

---


## S8 — Seed, verify, document

**Seeding.** One seeder per module under
`apps/backend/database/seeders/seed/`, wired into
`database/seeders/index.ts`. The existing pattern is the location seeder:
read a JSON file, insert with an upsert on the natural key, never update a
row that already exists unless the change is intentional.

| Module | Seed content |
|---|---|
| Identity | the initial global admin, through the Better Auth instance, as today |
| Location | the four administrative levels, from `raw/location/*.json` |
| Organization | company profile, one branch, one department, one cost centre, document sequences |
| Catalog | units, item categories, one price list |
| CRM | one customer, one contact, one address |
| HR | one employee, one employment contract, one bank account |
| Procurement | one supplier |
| Inventory | one warehouse |
| Finance | chart of accounts, one cash/bank account, payment terms |
| Accounting | one accounting period, one opening balance set |
| Approval | one policy per module that needs it |
| Payroll | the salary components |
| Licensing | one licensable application, one package |

**Rules.**

- Every seeder runs twice without error.
- A seeder never resets a password and never overwrites a row that a user
  changed.
- No seeder prints a secret. The auth seeder creates the admin through the
  Better Auth instance and never logs the password.

**Verification.** The verification queries in S7, then:

```sql
-- every module schema exists
SELECT schema_name FROM information_schema.schemata
 WHERE schema_name IN ('auth','location','organization','crm','catalog','hr',
   'procurement','inventory','sales','finance','accounting','projects',
   'aftersales','assets','payroll','documents','approval','budgeting',
   'investor','commerce','automation','licensing','audit')
 ORDER BY schema_name;
-- expected: 24 rows
```

**Documentation.** Update `.agents/docs/data-model.md` (remove the `erp`
schema, point at `docs/database/docs.dbml`), `.agents/docs/architecture.md`
(correct the `erp` schema ownership section), `.agents/docs/progress.md`
(record the exact commands and the outcome of every step) and
`.agents/docs/backlog.md` (move the status of the corresponding item).

**Exit criteria.**

- [ ] `bun run drizzle:seed` twice, both runs clean.
- [ ] `bun run typecheck`, `bun run lint`, `bun test` pass.
- [ ] The 24 schemas exist and the table count is 251.
- [ ] `docs.dbml` parses and reports 251 tables, 218 refs, 0 cross-module
      refs, 0 enums, 0 tables without a note.
- [ ] `data-model.md` and `architecture.md` match the database.

---

## Step to backlog mapping

| Step | Backlog item | Phase file |
|---|---|---|
| S1 | ERP-0002 (part), ERP-0008 | `phase-2-auth-access-customer-slice.md`, `phase-3-core-master-data.md` |
| S2 | ERP-0006, ERP-0008 | `phase-3-core-master-data.md` |
| S3 | ERP-0011 | `phase-4-sales-purchasing-accounting.md` |
| S4 | ERP-0010, ERP-0011, ERP-0012, ERP-0013 | `phase-4-sales-purchasing-accounting.md` |
| S5 | ERP-0015, ERP-0018 | `phase-4-sales-purchasing-accounting.md`, `phase-6-payroll-subscription-portals.md` |
| S6 | ERP-0016, ERP-0019, ERP-0020, ERP-0021, ERP-0022, ERP-0023 | `phase-5-reports-tax-period-close.md`, `phase-6-payroll-subscription-portals.md` |
| S7 | ERP-0014, ERP-0017 | `phase-4-sales-purchasing-accounting.md`, `phase-5-reports-tax-period-close.md` |
| S8 | ERP-0024 | `phase-7-uat-release.md` |

## Order of the schema versus the order of the code

The schema steps above are ordered by **dependency of the data**, not by the
order in which the business slices are written. The code slices follow
`backlog.md`. A schema step can land before the code that uses it, as long
as:

- the migration is applied to a disposable database first,
- the seed is idempotent,
- and the step's exit criteria are met.

A code slice that needs a table from a later step must wait for that step.
The Sales slice (ERP-0011) needs S4 (Finance) for the invoice and the
payment; it cannot be finished on S3 alone.

## What this document does not cover

- **Business parameter values.** Profit sharing schemes, tax rates, payroll
  components and provider credentials are business data. They arrive from the
  business, and the phases that need them are `blocked` until they arrive.
- **Performance.** Indexes beyond the ones in `docs.dbml` are added when a
  query proves the need, never as a blanket.
- **Data migration of the existing rows.** The only live business rows today
  are the location rows and the seeded admin. Everything else is a fresh
  table.
- **A production migration.** This document describes the changes. Running
  them against a production database is a separate, explicitly authorized
  operation.
