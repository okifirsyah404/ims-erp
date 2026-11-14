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

A foreign key may only connect two tables of the same module. `docs.dbml`
contains 231 `Ref:` declarations and 0 cross-module refs.

Verified by parsing the file (`validate-dbml.ts`, `@dbml/core`):

```text
parsed: 268 tables
cross-module refs: 0
timestamp gaps: 0
```

Every module owns exactly one Postgres schema, so a `Ref:` that crosses a
schema boundary would also cross a module boundary. The retired `warehouse`
schema is the one historical exception: its tables were folded into
`inventory` (ADR-0008), so what used to be an intra-module two-schema pair is
now an ordinary intra-schema reference.

### 2.2 No exception remains

There is no longer any module spanning two schemas. Warehouse and Inventory are
one module inside one schema, so every schema boundary in the contract is also
a module boundary and is crossed logically, never by a foreign key.

### 2.3 `ON DELETE` policy

| Action | When | Reason |
|---|---|---|
| `CASCADE` | the child has no meaning without the parent (a line of a document, a session of a user) | removing the parent must remove the children, otherwise orphans accumulate |
| `RESTRICT` | the parent is referenced by a financial or a master-data record (a supplier with purchase orders, an account with journal lines, a warehouse with stock movements) | the reference must be resolved before the parent goes |
| `SET NULL` | the link is optional and historical (a manager leaves, a parent branch closes, a reversed entry) | the record survives, the link is cleared |

Concrete mapping:

| Category | Action |
|---|---|
| Better Auth children (sessions, accounts, members, invitations, passkeys) | `CASCADE` |
| Document lines (quotation items, invoice items, journal lines, payslip items) | `CASCADE` |
| Master data referenced by money records (supplier, purchase order, chart of accounts, cash/bank account, employee, item, unit, warehouse, price list, leave type, tax type, accounting period) | `RESTRICT` |
| Self-referencing hierarchies (parent branch, parent department, parent account, parent category, parent menu, reversed entry, superseded document, renewed contract) | `SET NULL` |
| Optional links (invoice of a receipt, payment of a receipt, project of a ticket, journal entry of a depreciation) | `SET NULL` |

`RESTRICT` is the default posture for anything a financial record points at.
`CASCADE` is used only where the child is meaningless alone.

## 3. Tenant consistency

### 3.1 The problem

A foreign key checks that an id exists. It does not check that the id
belongs to the same tenant. Without a composite key, a row of tenant A can
legally point at a row of tenant B.

### 3.2 The rule

**Every query filters on `organization_id`.** Every write sets
`organization_id` from the request context, never from the client body.

### 3.3 The database backstop, inside a module

A composite foreign key ties the parent and the child to the same tenant:

```sql
FOREIGN KEY (organization_id, parent_id) REFERENCES parent (organization_id, id)
```

These composite foreign keys are implemented directly in the Drizzle schema
files, because DBML cannot express a composite `Ref:` (`@dbml/core` rejects
it with "A Ref field must be a binary relationship" and "Unequal fields in
ref endpoints").

Two properties of the SQL standard matter here:

- The referenced columns must have a **unique constraint** on
  `(organization_id, id)`. Postgres does not accept a plain unique index on
  `id` as the target of a composite foreign key, so each parent table gets
  a `UNIQUE (organization_id, id)` constraint.
- The default match type is `MATCH SIMPLE`: **if any referencing column is
  NULL, the constraint is satisfied without a check.** So the composite
  foreign key only bites once `organization_id` is `NOT NULL` and the parent
  id is `NOT NULL`. Both are the case for every tenant-scoped table today.
  Once ADR-0014 flips the tenant column to nullable, a row without an
  organization drops out of this backstop and relies on the owning module's
  contract method instead.

### 3.4 The database backstop, across modules

A composite foreign key across modules would violate the isolation rule.
Across modules, tenant consistency comes from the contract:

```text
assertCustomerOwnedByOrganization(customerId, orgId)
```

The owning module must expose an assert method that takes the id **and**
the organization id, and must reject a mismatch. A contract method that
only takes an id is not sufficient.

### 3.5 Where the tenant column is nullable

| Table | Why |
|---|---|
| `audit.audit_logs.organization_id` | a global admin action can happen outside any organization |
| `location.*` | global reference data, not tenant scoped |
| `inventory.*` | company-wide scope (ADR-0008) |
| `assets.*` | company-wide scope (ERP-0036 D11) |
| `company.*` | the one company behind every organization (ERP-0042) |
| `code_number.series` | company-wide numbering authority (ERP-0009) |
| `document.*` | company-wide documents allowed (ERP-0042) |

Every other table that carries the column has `organization_id text NOT NULL`
today. ADR-0014 flips the cross-module reference columns to nullable
everywhere, tenant column included; the flip is tracked as ERP-0037 and the
contract method, not the constraint, becomes the presence check.

Scope carve-out: `NULL` means "company-wide" only on the modules listed
above. Everywhere else `NULL` means "not (yet) linked" (ADR-0014).

## 4. Soft delete consistency

### 4.1 The rule

Feature code never hard deletes a row. It sets `deleted_at` to the unix
milliseconds of the deletion.

### 4.2 Consequences the schema handles

| Consequence | Handling |
|---|---|
| A reused code would collide with the unique index | **Partial unique index** `WHERE deleted_at IS NULL` on every `(organization_id, code)` pair, written directly in the Drizzle schemas (`uniqueIndex(...).where(sql\`deleted_at IS NULL\`)`). |
| A deleted parent would break the child | `ON DELETE` rules only matter for a real `DELETE`, which feature code does not issue. Soft delete does not cascade, so the child keeps its history. |
| A reference to a deleted row | The referencing module reads the target through the owning module's contract, which returns a soft-deleted row for history reads and refuses it for new writes. |
| Master data referenced by money | Cannot be hard deleted at all. The `deleted_at` marker is the only state, and the owning module refuses to soft-delete it when a financial record references it. |

Append-only ledgers, logs and projections (`inventory.stock_movements`,
`inventory.stock_balances`, `inventory.serial_tracked_items`,
`inventory.lot_batches`, `ticket.ticket_status_history`,
`audit.audit_logs`) carry no `deleted_at`: a ledger row is corrected by a
compensating row, and a projection row is rebuilt, never deleted. This is
documented in each table's note.

### 4.3 The read rule

Every list query filters `deleted_at IS NULL` unless the caller explicitly
asks for the trash. A soft-deleted row must never appear in a default read.

## 5. Uniqueness

### 5.1 Business codes

`(organization_id, code)` is unique on every document and master table that
has a `code`. Because the row may be soft deleted, the real index is
partial:

```sql
CREATE UNIQUE INDEX customers_org_code_uq
  ON crm.customers (organization_id, code)
  WHERE deleted_at IS NULL;
```

A unique index ignores `NULL`, so a nullable `organization_id` (ADR-0014)
would let two unlinked rows share a code. Those tables use the ADR-0008 pair:
`(organization_id, code) WHERE organization_id IS NOT NULL` plus
`(code) WHERE organization_id IS NULL`.

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
| `crm.customer_credit_limits` | `(organization_id, customer_id, effective_from)` |
| `catalog.item_prices` | `(price_list_id, item_id, valid_from)` |
| `catalog.item_uom_conversions` | `(item_id, from_unit_id, to_unit_id)` |
| `catalog.item_bundles` | `(bundle_item_id, component_item_id)` |
| `catalog.item_suppliers` | `(item_id, supplier_id)` |
| `hr.attendance_records` | `(organization_id, employee_id, attendance_date)` |
| `hr.employee_salary_components` | `(employee_id, component_code, effective_from)` |
| `payroll.payroll_periods` | `(organization_id, period_year, period_month)` |
| `payroll.payslip_items` | `(payslip_id, sequence)` |
| `accounting.account_balances` | `(account_id, accounting_period_id)` |
| `accounting.opening_balances` | `(account_id, as_of_date)` |
| `assets.asset_depreciations` | `(asset_id, period_year, period_month)` |
| `approval.approval_policy_versions` | `(approval_policy_id, version)` |
| `approval.approval_stages` | `(approval_request_id, stage_order)` |
| `license_*` | see `docs.dbml` |

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

Enforced by the service layer, per row, before the write. The Approval
module additionally carries `no_self_approval boolean NOT NULL DEFAULT true`
on `approval.approval_policy_versions`, so the rule is data, not code.

### 6.3 Approval flow integrity

| Rule | Where it lives |
|---|---|
| Only a `submitted` / `pending` record can be approved | service, guarded by the `status` `CHECK` |
| A stage opens only when the previous stage is finished | service, `approval.approval_stages.stage_order` |
| The approver count of a stage must be reached | service, `required_approver_count` |
| The amount must fall in the band of the stage | service, `min_amount` / `max_amount` on the stage and the threshold |
| A duplicate decision on the same stage is rejected | service, unique index `(approval_stage_id, approver_user_id)` on `approval.approval_decisions` |
| A decision log is append only | no `deleted_at` on `approval.approval_decisions` |
| A policy version is immutable | no `deleted_at`, no `updated_at` on `approval.approval_policy_versions` |
| The request points at the version that was in force | `approval.approval_requests.approval_policy_version_id NOT NULL` |
| A change of the source document invalidates the request | `approval.approval_requests.source_version`, compared by the owning module on write |

## 7. Concurrency

### 7.1 The rule

**A state transition is a conditional update.** The `WHERE` clause carries
the expected previous state, and the service checks the affected row count.
If zero rows were updated, another actor already moved the record.

```sql
UPDATE finance.payments
   SET status = 'approved', approved_by = $1, approved_at = $2
 WHERE id = $3
   AND status = 'submitted';
-- if rowCount <> 1 → the record was already approved, reject
```

This is the mechanism that makes "approve != execute" and "execute only after
approval" true under concurrency, without a lock.

### 7.2 Numbering

`code_number.series` is the single numbering authority. Allocation is a
locked row update inside the same transaction as the insert:

```sql
UPDATE code_number.series
   SET next_number = next_number + 1
 WHERE organization_id = $1 AND module = $2 AND document_type = $3
 RETURNING next_number - 1;
```

The `UPDATE ... RETURNING` takes the row lock, so two concurrent
transactions cannot receive the same number.

### 7.3 Stock

`inventory.stock_balances` is a projection, never the truth. The truth is
`inventory.stock_movements`, which is append only. The balance is updated
in the same transaction as the movement, with the movement row locked
first. A balance that does not match the sum of its movements is a bug in
the Inventory service, not a state to be tolerated.

### 7.4 Ledger posting

`accounting.journal_entries` is posted in one transaction:

1. Insert the header with `total_debit = total_credit` (the `CHECK` enforces it).
2. Insert the lines, each with exactly one positive side.
3. Update the account balances.
4. Mark the entry `posted`.

A failure at any step rolls back the whole thing. A posted entry is never
edited; a correction is a reversing entry linked through
`reversed_by_entry_id`.

### 7.5 Idempotency

An approval decision, a payment execution and a stock posting must be safe
to retry. The service uses a unique natural key as the idempotency anchor:

| Operation | Anchor |
|---|---|
| Approval decision | `(approval_stage_id, approver_user_id)` |
| Payment allocation | `(payment_id, invoice_id)` |
| Payslip line | `(payslip_id, sequence)` |
| Segment membership | `(segment_id, customer_id)` |
| Discount request parent | exactly one of `quotation_id` / `sales_order_id` |

## 8. Value integrity

### 8.1 Money

- Exact integer minor units in `bigint`. Never a float (ADR-0002).
- Every money column has a `CHECK` for the sign: `>= 0` for a total, `> 0`
  for a transaction amount.
- Derived totals are checked by the database where the identity is fixed:
  - `accounting.journal_entries`: `total_debit = total_credit`
  - `accounting.journal_lines`: exactly one positive side
  - `budgeting.cash_flow_plans`:
    `closing_balance = opening_balance + inflow_total - outflow_total`
  - `investor.profit_shares`: `net_amount = gross_amount - tax_amount`
- Header totals are recomputed from the lines by the service on every write.
  The stored total is a cache, the lines are the truth.

### 8.2 Quantity

`numeric(18,3)`, `CHECK` for `> 0` on a line quantity and `>= 0` on a
balance. A quantity of zero is never a line.

### 8.3 Dates

| Rule | Check |
|---|---|
| A period ends after it starts | `end_date >= start_date` |
| A due date is after an issue date | `due_date >= issue_date` |
| A contract ends after it starts | `end_date IS NULL OR end_date >= start_date` |
| An expiry is after an issue | `expires_on > issued_on` |
| A hire date is before a termination date | `termination_date >= hire_date` |
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
| Stock quantity | `inventory.stock_movements` | `inventory.stock_balances` |
| Item price | `catalog.item_prices` | `catalog.items.selling_price` is the default only |
| Money movement | `finance.payments` | `sales.receipts`, `finance.cash_bank_transactions`, `payroll.payroll_payments` |
| Employee advances | `finance.employee_advances` | — |
| Expense settlement | `finance.expense_settlements` | — |
| Goods and services | `catalog.items` | — |
| Customer address | `crm.customer_addresses` (`kind` discriminator) | — |
| General ledger balance | `accounting.journal_entries` + `journal_lines` | `accounting.account_balances` |
| Role and permission | code, `packages/common/src/authorization/erp-permissions.ts` | `auth.members.role`, `auth.user_role_assignments` |
| Approval decision | `approval.approval_decisions` | the `status` of the business document |
| Document version | `document.documents` | `document.templates.version` |

## 10. What the database cannot guarantee

Stated plainly, so nobody assumes otherwise.

| Risk | Why the database cannot catch it | Mitigation |
|---|---|---|
| Cross-module reference to another tenant | no foreign key exists | the owning module's assert method, called before the write |
| Cross-module reference to a deleted row | no foreign key exists | the owning module's resolve method returns the state |
| Self approval | needs two columns of the same row compared | service check plus the `no_self_approval` policy flag |
| Approval of a stale document | needs the source row | `source_version` comparison by the owning module |
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
7. Every new unique code index is partial with `WHERE deleted_at IS NULL`.
8. The seed still runs twice without error.
9. The tests cover authorization, ownership and validation for the change.
