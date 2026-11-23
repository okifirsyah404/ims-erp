# Module Ownership

Companion to `docs.dbml` (canonical). Explains who owns which Postgres
schema, what a module is allowed to touch, and where the boundaries are.

Facts in this document are derived from `docs.dbml` and were checked by
parsing it (`@dbml/core` 11.0.0, transient, outside the repo).

## The rule

- Each **module** owns exactly one Postgres **schema**. The historical
  two-schema exception is **gone** and stayed gone: ADR-0026 split the product
  master and the physical estate out of `inventory` into the `product` and
  `warehouse` schemas, because reference/configuration data does not belong to
  the stock ledger (ADR-0008 ruled the opposite; ADR-0026 supersedes it). The
  Identity module owns the single `auth` schema, shared by Better Auth's 9 core
  tables and the 6 ERP extension tables.
- A **foreign key may only connect two tables of the same module**.
  `docs.dbml` contains 147 `Ref:` declarations and **0 cross-module refs**
  (`validate-dbml.ts` checks all 147; before 2026-11-05 it read
  `db.refs`, which `@dbml/core` v11 leaves empty, so the check passed vacuously).
- A **cross-module link** is a plain id column plus a column note that **starts
  with** the sentence below — `gen-logical-references.ts` anchors its regex at
  the start of the note, so a note that buries these words mid-sentence is
  silently not counted:
  `Logical reference to <target>.id. Cross-module FK intentionally omitted.
  Validated through the <Module> module contract.`
- 169 such logical reference columns exist across 25 targets (re-derived on each run of `gen-logical-references.ts` and checked by `validate-dbml.ts`).
- Every one of them is a **nullable** plain id column (ADR-0014); presence is
  a service-layer fact, enforced by the owning module's contract method, not
  by the database.
  Full list in `logical-references.md`.
- Cross-module reads and writes go through the owning module's exported
  service contract. Another module's repository is never imported.

## The 20 modules

| 1 | Identity | `auth` | 11 | 9 |
| 2 | Location | `location` | 4 | 3 |
| 3 | Company | `company` | 4 | 0 |
| 4 | Customer | `customer` | 6 | 3 |
| 5 | Supplier | `supplier` | 6 | 3 |
| 6 | Product | `product` | 4 | 1 |
| 7 | Warehouse | `warehouse` | 8 | 5 |
| 8 | Inventory | `inventory` | 20 | 16 |
| 9 | Sale | `sale` | 18 | 20 |
| 10 | Procurement | `procurement` | 9 | 11 |
| 11 | Finance | `finance` | 27 | 20 |
| 12 | Tax | `tax` | 5 | 3 |
| 13 | Payment | `payment` | 5 | 2 |
| 14 | Project | `project` | 28 | 23 |
| 15 | Ticket | `ticket` | 6 | 4 |
| 16 | Human Resource | `human_resource` | 12 | 11 |
| 17 | Document | `document` | 12 | 10 |
| 18 | Notification | `notification` | 2 | 1 |
| 19 | Audit | `audit` | 1 | 0 |
| 20 | Automation | `automation` | 4 | 2 |
| | **Total** | **20 schemas** | **192** | **147** |

The `webhook` module (ADR-0024 Q38) has **no schema and no tables**: it owns
the inbound provider HTTP edge and hands every call to `payment` or
`automation` through their exported webhook services.

Counts are re-derived from `docs.dbml` on every validation run
(`validate-dbml.ts`), and the cross-module references are in
`logical-references.md` (169 logical reference columns, 25 targets, 0
cross-module `Ref:`).
## Module profiles

Source of truth for every table is `docs.dbml`; this section states who owns
what and which contract each module offers. Ownership follows ADR-0024.
Every business schema also owns a `code_numberings` table and a
`<Module>NumberingService` (ADR-0024 Q32): numbering is per module, there is
no central code-number module.

### 1. Identity - `auth`

- **Owns** the 9 Better Auth core tables (`users`, `sessions`, `accounts`,
  `verifications`, `organizations`, `members`, `invitations`, `passkeys`,
  `apikeys`) plus `user_invitations` and `organization_settings`.
- The core tables are hand-maintained (`auth:generate` is never run).
- **Does not own** roles and permissions: the ERP role vocabulary is code
  (`packages/common/src/authorization/erp-permissions.ts`); `auth.members.role`
  carries the comma-joined role keys. The portal login moved to
  `customer.customers`; profile/preferences are no longer separate tables.
- **Contract**: `ExportedUserService` (`findById`, `findByEmail`,
  `issuePasswordToken`), `ExportedOrganizationService`
  (`requireOrganizationCode`: the `{ORG}` numbering token, the upper-cased
  organization slug) and the organization/membership guards.

### 2. Location - `location`

- **Owns** `provinces`, `regencies`, `districts`, `villages`: global reference
  data, not tenant scoped, seeded idempotently from
  `database/seeders/raw/location/*.json`.
- Address tables elsewhere store only `village_id`; the rest of the path is
  derived (ADR-0024 Q10).
- **Contract**: `ExportedLocationService.assertVillage`, `resolveVillagePath`.

### 3. Company - `company`

- **Owns** the one legal company (ADR-0011): `profiles`, `addresses`,
  `contacts`, `settings`. Company-wide, no `organization_id`.
- `profiles.document_code` feeds the `{COMPANY}` numbering token.
- Bank accounts are **not** here any more: `finance.cash_bank_accounts`.
- **Contract**: `ExportedCompanyService` (`getLetterhead`, `getDocumentCode`,
  `requireDocumentCode`, `getDisplayName`).

### 4. Customer - `customer` (was `crm`)

- **Owns** `companies` (the B2B entity), `customers` (the people, including
  the portal login), `addresses`, `company_addresses`, `settings`.
- Leads moved to `project`; contacts merged into `customers`; the portal
  identity folded into `customers` (Q5, Q12, Q16).
- **Contract**: `ExportedCustomerService` (`assertCustomer`,
  `getActiveCustomer`, `getActiveCompany`, `resolvePortalIdentity`,
  `getSnapshot`).

### 5. Supplier - `supplier` (new, split from procurement)

- **Owns** `companies`, `suppliers` (the people/PIC), `addresses`,
  `company_addresses`, `settings`. Bank details are restricted.
- **Contract**: `ExportedSupplierService` (`assertActiveCompany`,
  `findCompanyByCode`, `findPerson`, `getPurchaseSnapshot`, `getBankDetails`).

### 6. Product - `product` (new, split out of inventory, ADR-0026)

- **Owns** the product (SKU) master `products` — including the website
  listing columns that were `catalog.web_listings` (ADR-0024 Q14) —
  `product_categories`, `settings` and `code_numberings` (`item_product`,
  `item_material`, `item_component`; pattern `{TYPE}-{COMPANY}-{SEQ:5}`).
- Stock balances, the ledger and serial units are **not** here: a unit's
  custody is an inventory fact. This module reads availability, the
  warehouse-scoped quantity and unit counts back through
  `ExportedInventoryService`.
- Rows may carry a null `organization_id` (global scope, ADR-0008).
- **Contract**: `ExportedProductService` (`assertProduct`, `isProductActive`,
  `productsById`, `getNameMap`, `productKinds`, `countUnits`,
  `categoryExists`, `findBySearch`), plus `ProductService`,
  `ProductCategoryService`, `ProductImageService` and
  `ProductListingService` through their DI tokens.

### 7. Warehouse - `warehouse` (new, split out of inventory, ADR-0026)

- **Owns** the physical estate: `warehouses`, `warehouse_addresses` (strict
  1:1), `warehouse_storages` (bins, one level, ADR-0008), `warehouse_managers`
  (PIC grants, ADR-0017), `warehouse_organizations` (ADR-0010),
  `warehouse_settings` (per warehouse), plus the module-wide `settings` and
  `code_numberings` (`warehouse`; pattern `{TYPE}-{COMPANY}-{SEQ:4}`).
- Warehouses are global: `organization_id` stays frozen at NULL and access
  comes from `warehouse_organizations` (ADR-0010). Writes are
  application-admin-only.
- What is physically in a warehouse (units, materials, equipment, open
  borrowings) is read through `ExportedInventoryService`.
- **Contract**: `ExportedWarehouseService` (`warehouseExists`,
  `warehouseIsActive`, `storageInWarehouse`, `getNameMap`, `organizationScope`,
  `isLinked`, `hasAddress`, `warehousesById`, `idsInScope`), plus
  `WarehouseService` and `WarehouseManagerService` through their DI tokens.

### 8. Inventory - `inventory` (absorbs `assets`; product and warehouse split out)

- **Owns** serial units (`item_serials`), physical units (`items`,
  `item_categories`, `documents`), the stock ledger (`movements`) and balances
  (`stocks`), adjustments, borrowing (`borrowing_requests`, `borrowings`,
  `borrowing_items`, both event tables), `maintenances`, `condition_checks`,
  `disposals`, tool sets, `settings` and `code_numberings` (`asset`,
  `stock_movement`, `stock_adjustment`, `borrowing`, `maintenance`, `disposal`,
  `tool_set`).
- The product master and the warehouse estate moved out (ADR-0026); every id
  pointing at them is a plain nullable column validated by the owning module's
  contract.
- Rows may carry a null `organization_id` (global scope, ADR-0008).
- **Contract**: `ExportedInventoryService` (`availableByProducts`,
  `productIdsInWarehouse`, `countSerials`, `serialExists`, `countLiveUnits`,
  `countOpenBorrowingsByOriginWarehouse`, `countMaterialStocks`,
  `countSerialKindsByWarehouse`, `countItemsByWarehouse`, `isItemOwnedBy`)
  plus the stock, item and serial-unit services other modules call through DI
  tokens (`StockService`, `ItemService`, `SerialUnitService`).

### 9. Sale - `sale` (was `sales`)

- **Owns** quotations and items/status history, orders and items/status
  history, delivery notes, returns, invoices, receipts, discount requests,
  contracts, targets, settings. Company-wide (ADR-0011).
- The legacy `sales.payments` scaffold is gone; money movement is `payment`.
- **Contract**: `ExportedOrderService.findOrder`,
  `ExportedInvoiceService.findById`.

### 10. Procurement - `procurement`

- **Owns** purchase requests, purchase orders, goods receipts, purchase
  returns, each with items. The supplier master is `supplier`.
- **Contract**: consumes `ExportedSupplierService`; offers PO/receipt reads to
  `finance` (supplier bills) through its services.

### 11. Finance - `finance` (absorbs `accounting`)

- **Owns** the chart of accounts, periods, journals and templates, opening and
  account balances, cash/bank accounts and transactions, reconciliations,
  supplier bills, AR/AP open items, credit memos, expense claims, advances and
  settlements, asset depreciation, report archives, payment terms, settings.
- Journal `source_module` vocabulary: `finance|sale|payment|tax|...`.
- Salary stays in `human_resource` (Q39); the employees' salary payee accounts
  are `cash_bank_accounts` rows with `employee_id` (ERP-0119), served at
  `/finance/employee-bank-accounts` and invisible to every treasury query.
- **Contract**: finance services for posting; `ExportedFinanceService`
  (repository-only, ERP-0122: `findPrimaryEmployeeBankAccount` for the
  payslip); `ExportedJournalService` (tax recap) is not built yet.

### 12. Tax - `tax` (new, split from accounting)

- **Owns** `taxes`, period `records`, signed `corrections`,
  `withholding_tax_records`. HTTP lives under `/taxes`.

### 13. Payment - `payment`

- **Owns** the single payment ledger (`payments`, channel `manual|gateway`),
  polymorphic `payment_allocations`, provider `gateways` (write-only secrets
  sealed with AES-256-GCM, `PAYMENT_SECRET_KEY`), settings.
- **Contract**: `ExportedPaymentService` (`listAllocations`,
  `requireExecuted`), `ExportedPaymentWebhookService` for the `webhook`
  module.

### 14. Project - `project` (was `projects`; absorbs leads, licensing, warranty)

- **Owns** projects and their tasks, phases, milestones, costs, evidence,
  handover, daily reports, site assignments, KPIs, changes, work plans, leads
  and lead activities/attachments, warranties, and the license tables
  (applications, contracts, keys, activations, events, API keys).
- **Contract**: project/lead/warranty reads through its services.

### 15. Ticket - `ticket` (absorbs `aftersales` tickets)

- **Owns** `tickets`, `ticket_messages`, `ticket_templates`,
  `sub_ticket_templates`, settings. Templates and sub-tickets (Q29) are
  target-only in the dbml.

### 16. Human Resource - `human_resource` (was `hr`)

- **Owns** employees and addresses, attendance, leave types/requests,
  overtime, tasks, salaries and salary records, schedules, settings.
- **Contract**: `ExportedEmployeeService` (`findEmployeeById`,
  `findEmployeeByUserId`). Finance calls `findEmployeeById` before writing an
  employee payee account (`finance.cash_bank_accounts.employee_id`, ERP-0119).

### 17. Document - `document`

- **Owns** templates, issued documents and files, signatures and requests,
  user signatures, access logs, shares, tags and links, settings.
  `organization_id` is nullable (NULL = company-wide).
- `document.issue` takes the owning module's `code`.
- `DocumentService.createDraft` (ERP-0121) is the exception: it codes the draft
  from this module's own `document` series, for an owning module that has no
  code of its own (the employee documents of `human_resource`: `module =
  human_resource`, `source_type = employee`, `source_id = employees.id`).
  `listBySource` and `attachGeneratedFileTo` serve the same callers;
  `issueForSource` registers an already-final row the same way (the payslip,
  `source_type = employee_salary_record`, ERP-0122) and `readFile` returns a
  file's bytes for a ZIP bundle.

### 18. Notification - `notification`

- **Owns** `push_notifications` and `push_notification_templates`. App-scope:
  no `organization_id`; the organization travels as a tag (ADR-0016).
- **Contract**: `ExportedNotificationService`.

### 19. Audit - `audit`

- **Owns** `audit_logs`, append-only: no updates, no soft delete. The actor is
  a logical reference.

### 20. Automation - `automation`

- **Owns** the n8n outbox (`outbox_messages`), `faq_entries`,
  `whatsapp_conversations`, `whatsapp_messages`. Company-wide (ADR-0012).
- **Contract**: `ExportedWhatsappWebhookService` for the `webhook` module.

### Not a schema: `webhook`

The `webhook` module (ADR-0024 Q38) owns the inbound provider edge
(`/webhooks/*` only: the old URLs were removed, Q34 revised 2026-11-20). It
delegates to `ExportedPaymentWebhookService` and
`ExportedWhatsappWebhookService`: 200 for `accepted|duplicate|ignored`, 401
for `rejected`, 404 for an unknown provider.

## Why there is no `erp` schema

Early drafts of `architecture.md` mentioned an `erp` schema. It never existed:
`audit.audit_logs` replaced `erp.audit_logs`, `customer.customers` replaced
`erp.customers`.

## Cross-module contract obligations

Every logical reference implies a promise by the owning module:

1. **Existence** - the id resolves to a row of the target module.
2. **Tenant** - the row belongs to the same `organization_id` as the
   referring row, enforced in the owning module's read and assert methods, not
   by a foreign key.
   - **Nullable-org carve-out (ADR-0008).** Inventory rows may have a *null*
     `organization_id`, meaning global/company-wide, so "same
     `organization_id`" becomes "same scope": `referrow.organization_id IS
     NULL OR referrow.organization_id = owner.organization_id`. Callers must
     never interpret `NULL` as "any organization".
3. **Lifecycle** - the target is soft deleted, not hard deleted, so a
   reference stays resolvable for history.
4. **Nullability** - every cross-module reference is nullable (ADR-0014); the
   referring module's service decides whether the link is required and
   enforces it before the write.

The service layer must call the owning module's assert method before writing a
row that carries a logical reference. This replaces the integrity a foreign
key would have given.
