# Logical References

Companion to `docs.dbml` (canonical). Every cross-module link in the ERP,
where a foreign key is forbidden by the module isolation rule.

## What a logical reference is

A **logical reference** is a plain id column that points at a row owned by
another module. It is written as a column note in `docs.dbml`, always with the
same prefix, followed by the contract that validates it:

```text
Logical reference to <target>.id. Cross-module FK intentionally omitted.
Validated through the <Module> module contract.
```

An address note names the exact method instead (ADR-0024 Q10):
`Validated by ExportedLocationService.assertVillage on write; district, regency
and province are derived through ExportedLocationService.resolveVillagePath.`

Example from `docs.dbml`:

```dbml
Table customer.customers {
  id uuid [pk, default: `uuidv7()`]
  organization_id text [note: "Logical reference to auth.organizations.id. Cross-module FK intentionally omitted. Validated through the Identity module contract."]
}
```

## Why no foreign key

| Reason | Consequence |
|---|---|
| Module isolation is a hard architectural rule | A foreign key would let one module's schema depend on another module's schema. Dropping or renaming a table in module B would break module A's migration. |
| Independent deployability | A module can ship its own migration without coordinating with the owner of the referenced table. |
| Cross-module ownership is a service concern | The owning module decides what a valid reference is (tenant match, soft-delete state, lifecycle). A foreign key only checks existence, never ownership. |
| Soft deletes | A referenced row is soft deleted, never hard deleted, so the reference stays resolvable for history. A `RESTRICT` foreign key would block the delete path for no benefit. |

## The rules

1. **Type follows the target.** The column type matches the target column
   type: `uuid` for `uuid` primary keys, `text` for `text` primary keys
   (Better Auth uses `text` ids).
2. **The target must be the primary key** of a table in the owning module.
3. **Every cross-module reference is nullable** (ADR-0014). Presence is a
   service-layer fact, enforced by the owning module's contract method, not by
   the database: a soft delete, a merge or a reference that cannot be resolved
   must never block a write. `docs.dbml` already carries the nullable form for
   all 169 references; the Drizzle schema files still declare `not null` on the
   columns listed by ERP-0037 and are flipped module by module until that row
   closes.
4. **Tenant match is mandatory.** The referring row and the referenced row
   must have the same `organization_id`. This is enforced by the owning
   module's assert method, not by a foreign key.
5. **The owning module must expose a resolve/assert contract** that the
   referring module calls before writing.
6. **A logical reference is never a substitute for an intra-module foreign
   key.** Inside one module, use a real `Ref:`.
## Counts

| Metric | Value |
|---|---|
| Logical reference columns | 169 |
| Distinct targets | 25 |
| Cross-module `Ref:` declarations | 0 |
| Intra-module `Ref:` declarations | 162 |

Counts are re-derived on every run of `validate-dbml.ts`, which parses
`docs.dbml` with `@dbml/core` and fails the run if a `Ref:` crosses a module
boundary. This document is regenerated with `gen-logical-references.ts`.

## Distribution of the referring columns per target

| Target | Owner | Referring columns |
|---|---|---|
| `auth.organizations.id` | Identity | 53 |
| `auth.users.id` | Identity | 30 |
| `customer.customers.id` | Customer | 12 |
| `inventory.products.id` | Inventory | 10 |
| `human_resource.employees.id` | Human Resource | 8 |
| `location.villages.id` | Location | 8 |
| `customer.companies.id` | Customer | 7 |
| `document.documents.id` | Document | 6 |
| `project.projects.id` | Project | 6 |
| `supplier.companies.id` | Supplier | 5 |
| `payment.payments.id` | Payment | 3 |
| `inventory.movements.id` | Inventory | 2 |
| `inventory.warehouse_storages.id` | Inventory | 2 |
| `inventory.warehouses.id` | Inventory | 2 |
| `procurement.purchase_orders.id` | Procurement | 2 |
| `project.leads.id` | Project | 2 |
| `sale.invoices.id` | Sale | 2 |
| `sale.orders.id` | Sale | 2 |
| `finance.cash_bank_accounts.id` | Finance | 1 |
| `finance.payment_terms.id` | Finance | 1 |
| `inventory.item_serials.id` | Inventory | 1 |
| `inventory.items.id` | Inventory | 1 |
| `procurement.purchase_order_items.id` | Procurement | 1 |
| `project.warranties.id` | Project | 1 |
| `supplier.suppliers.id` | Supplier | 1 |

## The 25 targets in full

### `auth.organizations.id` - owner Identity, 53 referring columns

- `finance.account_balances`  ->  `organization_id`
- `finance.accounting_periods`  ->  `organization_id`
- `finance.ap_open_items`  ->  `organization_id`
- `finance.ar_open_items`  ->  `organization_id`
- `finance.bank_account_links`  ->  `organization_id`
- `finance.bank_reconciliation_items`  ->  `organization_id`
- `finance.bank_reconciliations`  ->  `organization_id`
- `finance.cash_bank_accounts`  ->  `organization_id`
- `finance.cash_bank_transactions`  ->  `organization_id`
- `finance.chart_of_accounts`  ->  `organization_id`
- `finance.credit_memos`  ->  `organization_id`
- `finance.employee_advances`  ->  `organization_id`
- `finance.expense_claim_items`  ->  `organization_id`
- `finance.expense_claims`  ->  `organization_id`
- `finance.expense_settlement_items`  ->  `organization_id`
- `finance.expense_settlements`  ->  `organization_id`
- `finance.journal_entries`  ->  `organization_id`
- `finance.journal_lines`  ->  `organization_id`
- `finance.journal_templates`  ->  `organization_id`
- `finance.opening_balances`  ->  `organization_id`
- `finance.payment_terms`  ->  `organization_id`
- `finance.report_archives`  ->  `organization_id`
- `finance.settings`  ->  `organization_id`
- `finance.supplier_bill_items`  ->  `organization_id`
- `finance.supplier_bills`  ->  `organization_id`
- `human_resource.employees`  ->  `organization_id`
- `inventory.stock_adjustment_items`  ->  `organization_id`
- `inventory.stock_adjustments`  ->  `organization_id`
- `inventory.warehouse_organizations`  ->  `organization_id`
- `payment.gateways`  ->  `organization_id`
- `payment.payment_allocations`  ->  `organization_id`
- `payment.payments`  ->  `organization_id`
- `payment.settings`  ->  `organization_id`
- `project.changes`  ->  `organization_id`
- `project.daily_reports`  ->  `organization_id`
- `project.kpi_definitions`  ->  `organization_id`
- `project.kpi_evaluations`  ->  `organization_id`
- `project.milestones`  ->  `organization_id`
- `project.phases`  ->  `organization_id`
- `project.site_assignments`  ->  `organization_id`
- `project.task_dependencies`  ->  `organization_id`
- `project.types`  ->  `organization_id`
- `project.work_plans`  ->  `organization_id`
- `sale.contracts`  ->  `organization_id`
- `sale.discount_requests`  ->  `organization_id`
- `sale.invoice_items`  ->  `organization_id`
- `sale.receipts`  ->  `organization_id`
- `sale.targets`  ->  `organization_id`
- `tax.corrections`  ->  `organization_id`
- `tax.records`  ->  `organization_id`
- `tax.taxes`  ->  `organization_id`
- `tax.withholding_tax_records`  ->  `organization_id`
- `ticket.ticket_templates`  ->  `organization_id`

### `auth.users.id` - owner Identity, 30 referring columns

- `audit.audit_logs`  ->  `actor_user_id`
- `company.profiles`  ->  `updated_by`
- `company.settings`  ->  `updated_by`
- `customer.code_numberings`  ->  `updated_by`
- `customer.companies`  ->  `created_by`
- `customer.companies`  ->  `owner_user_id`
- `customer.customers`  ->  `created_by`
- `customer.customers`  ->  `owner_user_id`
- `customer.customers`  ->  `portal_invited_by`
- `customer.settings`  ->  `updated_by`
- `inventory.borrowing_requests`  ->  `borrower_user_id`
- `inventory.code_numberings`  ->  `updated_by`
- `inventory.documents`  ->  `created_by`
- `inventory.movements`  ->  `created_by`
- `inventory.products`  ->  `created_by`
- `inventory.settings`  ->  `updated_by`
- `inventory.stock_adjustments`  ->  `approved_by`
- `inventory.stock_adjustments`  ->  `requested_by`
- `inventory.warehouse_settings`  ->  `updated_by`
- `notification.push_notifications`  ->  `user_id`
- `project.projects`  ->  `pic_user_id`
- `project.tasks`  ->  `assignee_user_id`
- `sale.quotations`  ->  `approved_by`
- `sale.quotations`  ->  `closed_by`
- `sale.quotations`  ->  `created_by`
- `sale.quotations`  ->  `sent_by`
- `supplier.code_numberings`  ->  `updated_by`
- `supplier.companies`  ->  `created_by`
- `supplier.settings`  ->  `updated_by`
- `supplier.suppliers`  ->  `created_by`

### `customer.customers.id` - owner Customer, 12 referring columns

- `finance.ar_open_items`  ->  `customer_id`
- `finance.credit_memos`  ->  `customer_id`
- `inventory.borrowing_requests`  ->  `borrower_customer_id`
- `project.license_contracts`  ->  `customer_id`
- `project.projects`  ->  `customer_id`
- `project.warranties`  ->  `customer_id`
- `sale.contracts`  ->  `customer_id`
- `sale.invoices`  ->  `customer_id`
- `sale.orders`  ->  `customer_id`
- `sale.quotations`  ->  `customer_id`
- `sale.returns`  ->  `customer_id`
- `ticket.tickets`  ->  `customer_id`

### `inventory.products.id` - owner Inventory (warehouse schema), 10 referring columns

- `finance.supplier_bill_items`  ->  `product_id`
- `procurement.goods_receipt_items`  ->  `product_id`
- `procurement.purchase_order_items`  ->  `product_id`
- `procurement.purchase_request_items`  ->  `product_id`
- `procurement.purchase_return_items`  ->  `product_id`
- `sale.delivery_note_items`  ->  `product_id`
- `sale.invoice_items`  ->  `product_id`
- `sale.order_items`  ->  `product_id`
- `sale.quotation_items`  ->  `product_id`
- `sale.return_items`  ->  `product_id`

### `human_resource.employees.id` - owner Human Resource, 8 referring columns

- `finance.employee_advances`  ->  `employee_id`
- `finance.expense_claims`  ->  `employee_id`
- `finance.expense_settlements`  ->  `employee_id`
- `inventory.maintenances`  ->  `performed_by_employee_id`
- `inventory.tool_sets`  ->  `custodian_employee_id`
- `project.daily_reports`  ->  `technician_employee_id`
- `project.kpi_evaluations`  ->  `employee_id`
- `project.site_assignments`  ->  `employee_id`

### `location.villages.id` - owner Location, 8 referring columns

- `company.addresses`  ->  `village_id`
- `customer.addresses`  ->  `village_id`
- `customer.company_addresses`  ->  `village_id`
- `human_resource.employee_addresses`  ->  `village_id`
- `inventory.warehouse_addresses`  ->  `village_id`
- `project.addresses`  ->  `village_id`
- `supplier.addresses`  ->  `village_id`
- `supplier.company_addresses`  ->  `village_id`

### `customer.companies.id` - owner Customer, 7 referring columns

- `project.license_contracts`  ->  `company_id`
- `project.projects`  ->  `company_id`
- `project.warranties`  ->  `company_id`
- `sale.invoices`  ->  `company_id`
- `sale.orders`  ->  `company_id`
- `sale.quotations`  ->  `company_id`
- `ticket.tickets`  ->  `company_id`

### `document.documents.id` - owner Document, 6 referring columns

- `finance.expense_claim_items`  ->  `receipt_document_id`
- `finance.expense_settlement_items`  ->  `receipt_document_id`
- `inventory.items`  ->  `document_id`
- `inventory.maintenances`  ->  `document_id`
- `sale.contracts`  ->  `document_id`
- `tax.corrections`  ->  `evidence_document_id`

### `project.projects.id` - owner Project, 6 referring columns

- `finance.employee_advances`  ->  `project_id`
- `finance.expense_settlement_items`  ->  `project_id`
- `finance.expense_settlements`  ->  `project_id`
- `finance.journal_lines`  ->  `project_id`
- `inventory.borrowing_items`  ->  `project_id`
- `ticket.tickets`  ->  `project_id`

### `supplier.companies.id` - owner Supplier, 5 referring columns

- `finance.ap_open_items`  ->  `supplier_company_id`
- `finance.supplier_bills`  ->  `supplier_company_id`
- `inventory.items`  ->  `supplier_company_id`
- `procurement.purchase_orders`  ->  `supplier_company_id`
- `procurement.purchase_returns`  ->  `supplier_company_id`

### `payment.payments.id` - owner Payment, 3 referring columns

- `finance.employee_advances`  ->  `payment_id`
- `finance.expense_claims`  ->  `payment_id`
- `sale.receipts`  ->  `payment_id`

### `inventory.movements.id` - owner Inventory (warehouse schema), 2 referring columns

- `procurement.goods_receipt_items`  ->  `movement_id`
- `sale.delivery_note_items`  ->  `movement_id`

### `inventory.warehouse_storages.id` - owner Inventory (warehouse schema), 2 referring columns

- `procurement.goods_receipts`  ->  `bin_id`
- `sale.delivery_notes`  ->  `bin_id`

### `inventory.warehouses.id` - owner Inventory (warehouse schema), 2 referring columns

- `procurement.goods_receipts`  ->  `warehouse_id`
- `sale.delivery_notes`  ->  `warehouse_id`

### `procurement.purchase_orders.id` - owner Procurement, 2 referring columns

- `finance.supplier_bills`  ->  `purchase_order_id`
- `inventory.items`  ->  `purchase_order_id`

### `project.leads.id` - owner Project, 2 referring columns

- `automation.whatsapp_conversations`  ->  `lead_id`
- `sale.quotations`  ->  `lead_id`

### `sale.invoices.id` - owner Sale, 2 referring columns

- `finance.ar_open_items`  ->  `invoice_id`
- `finance.credit_memos`  ->  `invoice_id`

### `sale.orders.id` - owner Sale, 2 referring columns

- `project.license_contracts`  ->  `order_id`
- `project.projects`  ->  `order_id`

### `finance.cash_bank_accounts.id` - owner Finance, 1 referring column

- `payment.payments`  ->  `cash_bank_account_id`

### `finance.payment_terms.id` - owner Finance, 1 referring column

- `sale.invoices`  ->  `payment_term_id`

### `inventory.item_serials.id` - owner Inventory (warehouse schema), 1 referring column

- `ticket.tickets`  ->  `item_serial_id`

### `inventory.items.id` - owner Inventory (warehouse schema), 1 referring column

- `finance.asset_depreciations`  ->  `item_id`

### `procurement.purchase_order_items.id` - owner Procurement, 1 referring column

- `finance.supplier_bill_items`  ->  `purchase_order_item_id`

### `project.warranties.id` - owner Project, 1 referring column

- `ticket.tickets`  ->  `warranty_id`

### `supplier.suppliers.id` - owner Supplier, 1 referring column

- `procurement.purchase_orders`  ->  `supplier_pic_id`

## Contract obligations per target

Each target below names the exported service of the owning module
(`docs/plan/database-refactor/02-shared-patterns.md` §4) that the referring
module must call before writing a row that carries the reference. Concrete
method names live in that module's `contracts/` file; only the methods the plan
fixes by name are repeated here.

| Target | Contract entry point | Extra rule |
|---|---|---|
| `auth.organizations.id` | `organization` module contract | The organization must exist and be live; the actor must belong to it. |
| `auth.users.id` | `ExportedUserService.assertUser`, `getUsersByIds` | The user must be live; a portal login is never an ERP organization member. |
| `customer.customers.id` | `ExportedCustomerService.assertActiveCustomer` | The customer must be active for a new document; soft deleted rows stay resolvable for history. |
| `customer.companies.id` | `ExportedCustomerService` | The company must be active and not blocked. |
| `supplier.companies.id` | `ExportedSupplierService.assertActiveCompany` | The supplier must be active and not blocked. |
| `supplier.suppliers.id` | `ExportedSupplierService` | The PIC must belong to the referenced supplier company. |
| `inventory.products.id` | `ExportedInventoryService` | The product must not be soft deleted. |
| `inventory.items.id` | `ExportedInventoryService` | The tool unit must not be disposed. |
| `inventory.item_serials.id` | `ExportedInventoryService` | The serial must be available (not issued or sold). |
| `inventory.warehouses.id` | `ExportedInventoryService` | The warehouse must be active and reachable by the organization through `warehouse_organizations`. |
| `inventory.warehouse_storages.id` | `ExportedInventoryService` | The storage must belong to the referenced warehouse. |
| `inventory.movements.id` | `ExportedInventoryService` | The movement must be posted. |
| `sale.orders.id` | `ExportedOrderService` | The order must not be cancelled. |
| `sale.invoices.id` | `ExportedInvoiceService` | The invoice must not be void. |
| `procurement.purchase_orders.id` | `ExportedPurchaseOrderService` | The order must not be cancelled. |
| `procurement.purchase_order_items.id` | `ExportedPurchaseOrderService` | The line must belong to the referenced order. |
| `finance.payment_terms.id` | `ExportedFinanceService` | The terms must be active. |
| `finance.cash_bank_accounts.id` | `ExportedCashBankAccountService` | The account must be active. |
| `payment.payments.id` | `ExportedPaymentService` | The payment must be executed. |
| `project.projects.id` | `ExportedProjectService` | The project must not be cancelled. |
| `project.leads.id` | `ExportedLeadService` | The lead must be live. |
| `project.warranties.id` | `ExportedWarrantyService` | The warranty must be issued and inside its period. |
| `human_resource.employees.id` | `ExportedEmployeeService` | The employee must not be terminated. |
| `location.villages.id` | `ExportedLocationService.assertVillage(id)`, `resolveVillagePath(ids[])` | Addresses store only `village_id`; the province/regency/district path is derived, never stored (Q10). |
| `document.documents.id` | `document` module contract | The document must be issued, not draft and not void. |

## Validation rules per reference class

### Tenant scope (`organization_id`)

- Every tenant scoped table carries `organization_id`. It is nullable per
  ADR-0014: `NULL` means global/company-wide data (ADR-0008), and
  `inventory.warehouses.organization_id` is frozen at `NULL` because warehouse
  access comes from `warehouse_organizations` (ADR-0010). Drizzle still
  declares the tenant columns `not null` until ERP-0037 lands.
- Every read query filters on `organization_id`, always. A missing filter is
  a bug, not a warning.
- Every write sets `organization_id` from the request context, never from
  the client body.
- The composite tenant foreign key in the Drizzle schemas closes
  the gap **inside** a module: `(organization_id, parent_id)` must match
  `(organization_id, id)` of the parent. Cross-module the same guarantee is
  provided by the contract call. The composite FK is `MATCH SIMPLE`, so a
  `NULL` `organization_id` skips that check (ADR-0014).

### Actor scope (`*_by`, `*_by_user_id`, `requested_by`, `approved_by`)

- The actor must be a member of the row's organization.
- The actor must not be the requester of the same record when the workflow
  forbids self approval.

### Master data scope (products, items, customers, suppliers, employees)

- The target must be active (`is_active = true` where the column exists).
- The target must not be soft deleted (`deleted_at IS NULL`).
- The target must belong to the same organization.

### Document scope (`document_id`, `receipt_document_id`)

- The document must exist in the same organization.
- A receipt document used as payment evidence must be `issued`, never
  `draft` and never `void`.

### Money scope (`payment.payments.id`, `finance.cash_bank_transactions.id`)

- A payment reference is only valid on an `executed` payment.
- A cash bank transaction reference is only valid on a `posted` transaction.

### Ticket scope (`ticket.tickets.*`)

- A portal customer may list and read only tickets whose `customer_id`
  matches its linked customer record and whose `organization_id` matches the
  session's organization.
- Internal notes (`ticket_messages.is_internal_note`) are filtered out of
  every portal response at the service layer.
- `assignee_user_id` must be a member of the ticket's organization with a
  staff role; portal (customer-role) members can never be assignees.

## How to check this document against the schema

This document is generated from the parsed DBML by
`gen-logical-references.ts` (same directory). Logical reference columns and
their targets are extracted by matching the note pattern

```text
Logical reference to <target>.id. Cross-module FK intentionally omitted.
```

against every column note in the parsed model, so the counts and the target
lists above cannot drift from `docs.dbml`. `validate-dbml.ts` re-checks on
every run that no `Ref:` crosses a module boundary and reports the totals.
