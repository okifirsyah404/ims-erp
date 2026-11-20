# Integrity and Consistency

Companion to `docs.dbml` (canonical). How the database keeps its promises
when a foreign key cannot, and which rule covers which risk.

## 1. The layers

Integrity is enforced at four levels. Each level catches what the level
above cannot.

| Level | Mechanism | Catches | Cannot catch |
|---|---|---|---|
| 1 | Service / use case | business rules, readable errors, ordering, separation of duties | a concurrent write, a direct SQL mistake |
| 2 | Database constraint (`CHECK`, unique index) | value ranges, vocabulary, uniqueness, arithmetic identities | cross-module ownership, lifecycle |
| 3 | Foreign key (`Ref:`) | existence of a row in the same module | cross-module ownership, soft-delete state |
| 4 | Contract validation | cross-module ownership, tenant match, lifecycle state | anything not called explicitly |

Level 4 is the replacement for the foreign key that module isolation
forbids. It is not optional: **a write that carries a logical reference must
call the owning module's assert method first**.

## 2. Foreign key policy

### 2.1 The rule

A foreign key may only connect two tables of the same schema. `docs.dbml`
contains 162 `Ref:` declarations and 0 cross-module refs, across 188 tables in
18 schemas (ADR-0024).

Verified by parsing the file (`validate-dbml.ts`, `@dbml/core`):

```text
parsed: 188 tables, 162 refs
cross-module refs: 0
timestamp gaps: 0
drizzle parity drift: 0
```

Every business module owns exactly one Postgres schema, so a `Ref:` that
crosses a schema boundary would also cross a module boundary. The retired
`warehouse` schema was folded into `inventory` (ADR-0008), so what used to be
an intra-module two-schema pair is now an ordinary intra-schema reference.

### 2.2 No exception remains

No business module spans two schemas. The one shared schema is `auth`, which
the `user` and `organization` backend modules both use because Better Auth owns
those tables; it is still a single schema, so every schema boundary in the
contract is crossed logically, never by a foreign key. The `webhook` module
has no schema and no tables.

### 2.3 `ON DELETE` policy

| Action | When | Reason |
|---|---|---|
| `CASCADE` | the child has no meaning without the parent (a line of a document, a session of a user) | removing the parent must remove the children, otherwise orphans accumulate |
| `RESTRICT` | the parent is referenced by a financial or a master-data record (a supplier with purchase orders, an account with journal lines, a warehouse with stock movements) | the reference must be resolved before the parent goes |
| `SET NULL` | the link is optional and historical (a manager leaves, a parent branch closes, a reversed entry) | the record survives, the link is cleared |

Concrete mapping:

| Category | Action |
|---|---|
| Better Auth children (sessions, accounts, members, invitations, passkeys, organization settings) | `CASCADE` |
| Document lines (quotation items, order items, invoice items, journal lines, purchase order items) | `CASCADE` |
| Master data referenced by money records (customer company, supplier company, product, warehouse, chart of accounts, accounting period, cash/bank account, tax) | `RESTRICT` |
| Self-referencing hierarchies and history links (parent category, parent ticket, superseded document, reversed journal entry, renewed license contract, employee manager) | `SET NULL` |
| Optional links (storage bin of a stock row, gateway of a payment, template of a ticket or document, journal entry of a depreciation) | `SET NULL` |

Across the 162 declared `Ref:` lines the split is `CASCADE` 72, `RESTRICT` 64,
`SET NULL` 26. `RESTRICT` is the default posture for anything a financial
record points at. `CASCADE` is used only where the child is meaningless alone.

## 3. Tenant consistency

### 3.1 The problem

A foreign key checks that an id exists. It does not check that the id
belongs to the same tenant. Without a composite key, a row of tenant A can
legally point at a row of tenant B.

### 3.2 The rule

**Every query on an organization-scoped table filters on `organization_id`**
(with the `IS NULL OR` form where the table defines a global scope, see
`data-dictionary.md` 1.2). Every write sets `organization_id` from the request
context, never from the client body. Tables without the column are
company-wide (ADR-0011) and are protected by role permissions, not by a
tenant filter.

### 3.3 The database backstop, inside a module

A composite foreign key can tie a parent and a child to the same tenant:

```sql
FOREIGN KEY (organization_id, parent_id) REFERENCES parent (organization_id, id)
```

DBML cannot express a composite `Ref:` (`@dbml/core` rejects it with "A Ref
field must be a binary relationship" and "Unequal fields in ref endpoints"),
and the baseline v2 Drizzle schemas **do not declare any composite tenant
foreign key** (verified: no `foreignKey()` in `apps/backend/drizzle/schemas`).
Two properties of the SQL standard explain why this backstop is weak now:

- The referenced columns would need a **unique constraint** on
  `(organization_id, id)`; Postgres does not accept a plain unique index on
  `id` as the target of a composite foreign key.
- The default match type is `MATCH SIMPLE`: **if any referencing column is
  NULL, the constraint is satisfied without a check.** Since ADR-0014 made the
  tenant column nullable everywhere it exists, a composite foreign key could
  not guard a row without an organization anyway.

Tenant consistency inside a module therefore comes from the owning service
(the same assert-by-organization rule used across modules), and plain
single-column foreign keys guarantee only existence. If a composite backstop
is reintroduced it must be added to the Drizzle schema first and recorded here.

### 3.4 The database backstop, across modules

A composite foreign key across modules would violate the isolation rule.
Across modules, tenant consistency comes from the contract:

```text
assertCustomer(customerId, orgId)      // ExportedCustomerService
```

The owning module must expose an assert method that takes the id (and the
organization id wherever the target table is organization-scoped), and must
reject a mismatch. Company-wide targets (for example `customer.*`) have no
organization to match; the assert checks existence and liveness only. A contract method that
only takes an id is not sufficient.

### 3.5 Where the tenant column is nullable

| Table | Why |
|---|---|
| `audit.audit_logs.organization_id` | a global admin action can happen outside any organization |
| `inventory.*` (where the column exists) | global scope: `NULL` = company-wide (ADR-0008) |
| `document.*` | company-wide documents allowed |
| `finance.*`, `tax.*`, `payment.payments`, `payment.payment_allocations`, `payment.gateways` | the column is a nullable logical reference; presence is a service-layer fact (ADR-0014) |
| `auth.user_invitations` | an invitation may precede an organization |
| the organization-scoped part of `sale`, `project`, `procurement`, `ticket`, `human_resource`, `automation` | e.g. `sale.invoices`, `project.types`, `procurement.purchase_requests`, `ticket.ticket_templates`, `human_resource.employees`, `automation.outbox_messages` |

No `organization_id` at all: `location.*`, `company.*`, `customer.*`,
`supplier.*`, `notification.*`, every `<schema>.code_numberings` table, the
module `settings` tables keyed only by `(setting_group, setting_key)` (all
except `finance.settings` and `payment.settings`, which carry the column), and
the company-wide core of `sale` / `project` / `procurement` / `ticket` /
`human_resource` (ADR-0011).

`organization_id text NOT NULL`: only `auth.members`, `auth.invitations` and
`auth.organization_settings` (intra-schema foreign key to
`auth.organizations.id`, `ON DELETE CASCADE`). **Every other `organization_id`
and every other cross-module id column is nullable**, in `docs.dbml` and in the
Drizzle schemas alike (ADR-0014): the owning service decides whether the value
is required for a use case and writes the active organization itself.
`bun docs/database/validate-dbml.ts` (check 6) compares nullability and SQL
type of every built column in both directions and fails on any mismatch; before
2026-11-20 it only compared names, and 61 cross-module columns had drifted to
`NOT NULL` in the Drizzle files.

Scope carve-out: `NULL` means "company-wide" only on the tables whose note says
"Null means global/company-wide" (mainly `inventory.*`) and on
`audit.audit_logs`. Everywhere else `NULL` means "not (yet) linked"
(ADR-0014); the contract method, not the constraint, is the presence check.

## 4. Soft delete consistency

### 4.1 The rule

Feature code never hard deletes a row. It sets `deleted_at` to the unix
milliseconds of the deletion.

### 4.2 Consequences the schema handles

| Consequence | Handling |
|---|---|
| A reused code would collide with the unique index | **Partial unique index** `WHERE deleted_at IS NULL` on the unique keys that must free their value on delete (most `code`, `slug`, `sku` and natural-key uniques), written directly in the Drizzle schemas (`uniqueIndex(...).where(sql\`deleted_at IS NULL\`)`). |
| A deleted parent would break the child | `ON DELETE` rules only matter for a real `DELETE`, which feature code does not issue. Soft delete does not cascade, so the child keeps its history. |
| A reference to a deleted row | The referencing module reads the target through the owning module's contract, which returns a soft-deleted row for history reads and refuses it for new writes. |
| Master data referenced by money | Cannot be hard deleted at all. The `deleted_at` marker is the only state, and the owning module refuses to soft-delete it when a financial record references it. |

Append-only ledgers, logs and projections (`inventory.movements`,
`inventory.stocks`, `inventory.borrowing_events`,
`inventory.borrowing_request_events`, `finance.ar_open_items`,
`finance.ap_open_items`, `audit.audit_logs`) carry no `deleted_at`: a ledger
row is corrected by a compensating row, and a projection row is rebuilt,
never deleted. This is documented in each table's note. The Better Auth
tables other than `auth.users` and `auth.organizations` are hard deleted by
Better Auth itself and must never gain a `deleted_at` column.

### 4.3 The read rule

Every list query filters `deleted_at IS NULL` unless the caller explicitly
asks for the trash. A soft-deleted row must never appear in a default read.

## 5. Uniqueness

### 5.1 Business codes

`code` (company-wide tables) or `(organization_id, code)` (organization-scoped
tables) is unique on every document and master table that has a `code`.
Because the row may be soft deleted, the real index is partial:

```sql
CREATE UNIQUE INDEX products_slug_uq
  ON inventory.products (slug)
  WHERE deleted_at IS NULL;
```

Not every code index is partial: for example `finance.journal_entries`
declares a plain `(organization_id, code)` unique
(`journal_entries_org_code_uq`), so a soft-deleted entry keeps its code
reserved. Read the index in the Drizzle schema before assuming either form.

A unique index ignores `NULL`, so a nullable `organization_id` (ADR-0014)
would let two unlinked rows share a code. Tables with a global scope use the
ADR-0008 pair: `(organization_id, code) WHERE organization_id IS NOT NULL`
plus `(code) WHERE organization_id IS NULL` (for example
`inventory.products`, `inventory.movements`, `inventory.borrowings`).
`inventory.items.code` is globally unique in a single index.

Codes are allocated from the owning module's `<schema>.code_numberings`
table (see 7.2).

### 5.2 Global reference data

`location.provinces.code`, `location.regencies.code`,
`location.districts.code` and `location.villages.code` are globally unique
(no `organization_id` on those tables), and the code is not reused after a
soft delete either, because the location code is the real administrative
code.

### 5.3 Natural keys

Several tables have a natural key that is not a code:

| Table | Natural key |
|---|---|
| `inventory.stocks` | `(organization_id, warehouse_id, product_id, bin_id)` for scoped rows, `(warehouse_id, product_id, bin_id)` for global rows (`NULLS NOT DISTINCT`) |
| `inventory.borrowing_items` | `(borrowing_request_id, item_id)` |
| `inventory.tool_set_items` | `(tool_set_id, item_id)` |
| `inventory.warehouse_storages` | `(warehouse_id, code)` |
| `inventory.warehouse_managers` | `(warehouse_id, user_id)` |
| `inventory.warehouse_organizations` | `(warehouse_id, organization_id)` |
| `sale.targets` | `(organization_id, sales_user_id, period_year, period_month)` |
| `finance.accounting_periods` | `(organization_id, period_year, period_month)` |
| `finance.journal_lines` | `(journal_entry_id, line_no)` |
| `finance.journal_entries` | `(organization_id, idempotency_key)` when the key is set |
| `finance.account_balances` | `(account_id, accounting_period_id)` |
| `finance.opening_balances` | `(account_id, as_of_date)` |
| `finance.asset_depreciations` | `(item_id, period_year, period_month)` |
| `finance.ar_open_items` / `ap_open_items` | `(organization_id, invoice_id)` / `(organization_id, supplier_bill_id)` |
| `tax.taxes` | `(organization_id, code, effective_from)` |
| `tax.records` | `(organization_id, tax_type_id, period_year, period_month)` |
| `payment.payment_allocations` | `(payment_id, payable_type, payable_id)` |
| `payment.payments` | `(provider, provider_reference)` and `receipt_id`, both partial |
| `human_resource.attendances` | `(employee_id, attendance_date)` |
| `human_resource.employee_salaries` | `(employee_id, effective_from)` |
| `human_resource.employee_salary_records` | `(period, employee_id)` |
| `project.license_activations` | `(license_key_id, instance_id)` among live active rows |
| `project.kpi_evaluations` | `(kpi_definition_id, project_id, period_year, period_month)` |
| `document.templates` | `(organization_id, code, version)` |
| `document.tag_links` | `(document_id, document_tag_id)` |
| `automation.whatsapp_messages` | `(direction, external_id)` |
| `<schema>.code_numberings` | `(code_type)` among live rows |

## 6. Separation of duties

The ERP must prevent the person who prepares a record from approving or
executing it. This is a business rule, so it lives in the service, but the
schema supports it.

### 6.1 Who did what

The schema records the actor of every step as a separate column:

```text
requested_by / created_by     → prepared
submitted_by / prepared_by     → submitted
verified_by                    → verified
approved_by                    → approved
executed_by / posted_by        → executed
```

A single table with one generic `status` and one generic `approved_by` could
not express "approved by someone other than the requester" for a multi step
flow. The separate columns are what make the check possible.

### 6.2 The rule

```text
approved_by <> requested_by
executed_by <> requested_by
executed_by <> approved_by
```

Enforced by the service layer, per row, before the write. There is no
central approval module or `no_self_approval` policy flag any more
(ADR-0024): the rule lives in each owning module's service (for example the
`payment.payments` note states that execution requires approval and is not
allowed by the requester).

### 6.3 Approval flow integrity

Approval is a per-module status flow, not a shared engine. The
`approval.*` tables (policies, versions, requests, stages, decisions,
delegations) were removed.

| Rule | Where it lives |
|---|---|
| Only a `submitted` record can be approved | service, guarded by the module's `status` `CHECK` |
| Approval is one level for purchase requests | `procurement.purchase_requests` note: `draft -> submitted -> approved -> ordered`, rejection returns to `draft` with a reason |
| The actor of each step is recorded | `approved_by` / `approved_at`, `posted_by` / `posted_at`, `reversed_by` ... columns on the document |
| A ledger row is never edited after posting | `inventory.movements` and `finance.journal_entries` are corrected by a reversal |
| A duplicate posting is refused | `finance.journal_entries (organization_id, idempotency_key)`, and idempotent `posted` handling for `inventory.stock_adjustments` |

## 7. Concurrency

### 7.1 The rule

**A state transition is a conditional update.** The `WHERE` clause carries
the expected previous state, and the service checks the affected row count.
If zero rows were updated, another actor already moved the record.

```sql
UPDATE payment.payments
   SET status = 'approved', approved_by = $1, approved_at = $2
 WHERE id = $3
   AND status = 'submitted';
-- if rowCount <> 1 → the record was already approved, reject
```

This is the mechanism that makes "approve != execute" and "execute only after
approval" true under concurrency, without a lock.

### 7.2 Numbering

There is no central numbering schema (ADR-0024 Q6, Q32). Every business
schema owns a `<schema>.code_numberings` table, written only through that
module's `<Module>NumberingService`. Allocation is one atomic statement per
`(code_type, period_key)`:

```sql
INSERT INTO sale.code_numberings (code_type, period_key, next_number, ...)
VALUES ($1, $2, 2, ...)
ON CONFLICT (...) DO UPDATE SET next_number = code_numberings.next_number + 1
RETURNING next_number - 1;
```

The conflict update takes the row lock, so two concurrent transactions cannot
receive the same number. A new period (`2026`, `2026-11` or `all`, from
`reset_policy`) restarts at 1. The statement above is illustrative: the real
SQL is in the numbering service, and the table's contract is in `docs.dbml`.

### 7.3 Stock

`inventory.stocks` is a projection, never the truth. The truth is
`inventory.movements`, which is append only and covers both products and
physical items. The balance is updated by the service (never by a trigger) in
the same transaction as the movement; `recomputeFromLedger` is the repair
operation. A balance's `organization_id` follows the **warehouse** scope, not
the caller: a global warehouse has one shared balance row. A balance that does
not match the sum of its movements is a bug in the Inventory service, not a
state to be tolerated.

### 7.4 Ledger posting

`finance.journal_entries` is posted in one transaction by the finance posting
service; other modules never write journal rows directly (`source_module`
names the producer: `finance`, `sale`, `procurement`, `inventory`, `payment`,
`tax`, `human_resource`):

1. Insert the header with `total_debit = total_credit` (the `CHECK` enforces it).
2. Insert the lines, each with exactly one positive side.
3. Update the account balances.
4. Mark the entry `posted`.

A failure at any step rolls back the whole thing. A posted entry is never
edited; a correction is a reversing entry linked through
`reversed_by_entry_id`.

### 7.5 Idempotency

A journal posting, a payment execution or webhook, and a stock posting must
be safe to retry. The service uses a unique natural key as the idempotency
anchor:

| Operation | Anchor |
|---|---|
| Journal posting | `(organization_id, idempotency_key)` on `finance.journal_entries` |
| Payment allocation | `(payment_id, payable_type, payable_id)` |
| Gateway payment webhook | `(provider, provider_reference)` and `receipt_id` on `payment.payments`; a replayed webhook finds `receipt_id` and does nothing |
| Outbox message | `dedupe_key` on `automation.outbox_messages` |
| WhatsApp message | `(direction, external_id)` on `automation.whatsapp_messages` |
| Lead intake | `idempotency_key` on `project.leads` |
| Stock adjustment posting | idempotent `posted` transition (only `posted` writes movements) |

## 8. Value integrity

### 8.1 Money

- Exact integer minor units in `bigint`. Never a float (ADR-0002).
- Every money column has a `CHECK` for the sign: `>= 0` for a total, `> 0`
  for a transaction amount.
- Derived totals are checked by the database where the identity is fixed:
  - `finance.journal_entries`: `total_debit = total_credit`
  - `finance.journal_lines`: exactly one positive side
  - `finance.employee_advances`: `settled_amount >= 0` and
    `settled_amount <= amount`
- Header totals are recomputed from the lines by the service on every write.
  The stored total is a cache, the lines are the truth.

### 8.2 Quantity

`numeric(18,3)` (a few line quantities use `numeric(18,4)`), `CHECK` for
`> 0` on a line quantity and `>= 0` on a balance (`inventory.stocks`). A
quantity of zero is never a line. `inventory.movements` carries a signed
`quantity <> 0` check.

### 8.3 Dates

| Rule | Check |
|---|---|
| A period ends after it starts | `end_date >= start_date` |
| A due date is after an issue date | `due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date` |
| An optional range ends after it starts | `end_date IS NULL OR start_date IS NULL OR end_date >= start_date` |
| A warranty expires after acquisition | `warranty_expires_on IS NULL OR acquired_on IS NULL OR warranty_expires_on >= acquired_on` |
| A hire date is before a termination date | `termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date` |
| A month number | `BETWEEN 1 AND 12` |
| A percentage | `BETWEEN 0 AND 100` |
| A progress | `BETWEEN 0 AND 100` |

### 8.4 Status vocabularies

Every `status`, `type`, `kind`, `movement_type`, `decision`,
`payment_method`, `priority` and comparable column carries a `CHECK` with
the closed list of values. The complete list is in the `Checks { }` block
of the table in `docs.dbml`.

The vocabulary is duplicated in three places, deliberately:

1. The `CHECK` constraint in the database.
2. The TypeScript constant in the owning module's schema file.
3. The `Checks { }` block in `docs.dbml`.

The `CHECK` is the enforcement. The other two are documentation and the
source for the API contract. When they disagree, the `CHECK` wins and the
other two are a bug.

## 9. Single source of truth

Several tables would naturally duplicate each other. They are deliberately
split by ownership, with one side authoritative.

| Concern | Authoritative | Derived / mirror |
|---|---|---|
| Stock quantity | `inventory.movements` | `inventory.stocks` |
| Product master | `inventory.products` | — (the old `catalog.items` and price lists are gone) |
| Physical unit | `inventory.items` | — |
| Money movement | `payment.payments` | `sale.receipts` (proof only), `finance.cash_bank_transactions` |
| Payables settled by a payment | `payment.payment_allocations` | the `status` of the invoice / bill / advance |
| Employee advances | `finance.employee_advances` | — |
| Expense settlement | `finance.expense_settlements` | — |
| Customer address | `customer.addresses` / `customer.company_addresses` | — |
| General ledger balance | `finance.journal_entries` + `journal_lines` | `finance.account_balances`, `finance.ar_open_items` / `ap_open_items` |
| Role and permission | code, `packages/common/src/authorization/erp-permissions.ts` | `auth.members.role` |
| Document version | `document.documents` | `document.templates.version` |

## 10. What the database cannot guarantee

Stated plainly, so nobody assumes otherwise.

| Risk | Why the database cannot catch it | Mitigation |
|---|---|---|
| Cross-module reference to another tenant | no foreign key exists | the owning module's assert method, called before the write |
| Cross-module reference to a deleted row | no foreign key exists | the owning module's resolve method returns the state |
| Self approval | needs two columns of the same row compared | service check in the owning module (there is no policy flag table any more) |
| A tenant mismatch inside one module | no composite foreign key exists in the schemas (see 3.3) | the owning service filters and asserts by organization |
| Stock going negative | needs the sum of the ledger | the Inventory service computes the available quantity inside the transaction |
| Duplicate request on retry | needs an idempotency key from the client | service idempotency key, plus the natural key unique index |
| A direct `UPDATE` bypassing the service | — | database role permissions: the application role has no `DELETE` on ledger tables, and no `TRUNCATE` anywhere |

## 11. Verification checklist for a change

Before a schema change is accepted:

1. The change is in `docs.dbml`.
2. The migration is generated and the SQL was read by a human.
3. The migration was applied to a **disposable** database.
4. Every new status value was added to the `CHECK`, the TypeScript constant
   and the API contract together.
5. Every new logical reference has the standard note wording and a contract
   method on the owning side.
6. Every new cross-module link has **no** `Ref:`.
7. Every new unique code index is partial with `WHERE deleted_at IS NULL`
   unless the table deliberately keeps deleted codes reserved (state it in
   the table note).
8. The seed still runs twice without error.
9. The tests cover authorization, ownership and validation for the change.
