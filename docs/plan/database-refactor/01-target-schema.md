# Target schema and old -> new map

Legend for **Status**: `built` = a Drizzle table exists today and code uses it
(steps 2-6 apply); `new` = required by this refactor, built in this epic;
`target` = listed by the owner, defined in `docs.dbml` only, built later by its
own feature (Q22).

Every schema that allocates document codes also gets `<schema>.code_numberings`
(`02-shared-patterns.md` §1); it is listed once per schema below.

## auth (modules `user` + `organization`)

| Table | From | Status |
|---|---|---|
| accounts, apikeys, invitations, members, organizations, passkeys, sessions, users, verifications | `auth.*` (Better Auth) | built, unchanged |
| user_invitations | `auth.user_invitations` (`role.schema.ts`) | built |
| organization_settings | `organization.settings` + planned `organization.fiscal_settings` | built (renamed) |

Removed: `auth.portal_identities` (-> `customer.customers`), `auth.user_profiles`,
`auth.user_preferences`, `auth.identity_verifications`, `auth.user_devices`
(never built). Drizzle files `portal.schema.ts` and `role.schema.ts` fold into
`auth.schema.ts` (user/organization ERP tables kept in a clearly marked section;
Better Auth core tables stay hand-maintained - never `auth:generate`).

## location (module `location`)

provinces, regencies, districts, villages - built, unchanged.

## company (module `company`)

| Table | From | Status |
|---|---|---|
| profiles | `company.profiles` | built |
| addresses | `company.head_office_addresses` | built (renamed) |
| contacts | `company.contacts` | built |
| settings | `company.settings` | built |

Removed: `company.bank_accounts` -> `finance.cash_bank_accounts` (Q19).

## customer (module `customer`, was `crm`)

| Table | From | Status |
|---|---|---|
| companies | `crm.customers` rows with `customer_type` company/government/partner | built (split) |
| customers | `crm.customers` individuals + `crm.customer_contacts` + `auth.portal_identities` | built (merged) |
| addresses | new (addresses of a person) | new |
| company_addresses | `crm.customers.address_line/village_id/postal_code` of companies | new (data moved) |
| settings | new | new |
| code_numberings | `code_number.series` rows of module crm/customer | new |

Removed: `crm.leads`, `lead_activities`, `lead_attachments` (-> `project`);
target-only `customer_groups`, `customer_segments`, `customer_segment_members`,
`customer_interactions`, `customer_credit_limits`, `crm.customer_addresses`.

## supplier (module `supplier`, split out of `procurement`)

| Table | From | Status |
|---|---|---|
| companies | `procurement.suppliers` (company/government) | built (moved) |
| suppliers | `procurement.suppliers` PIC columns + individual suppliers | built (split) |
| addresses | new | new |
| company_addresses | `procurement.suppliers.address_line/village_id/postal_code` | new (data moved) |
| settings | new | new |
| code_numberings | `code_number.series` supplier rows | new |

## inventory (module `inventory`, absorbs `assets` and `catalog`)

| Table | From | Status |
|---|---|---|
| products | `inventory.items` + `catalog.web_listings` (1:1 listing columns) | built (renamed + merged) |
| product_categories | `inventory.item_categories` | built (renamed) |
| item_serials | `inventory.serial_tracked_items` (`item_id` -> `product_id`) | built (renamed) |
| items | `assets.assets` (one row per physical unit; `asset_type` -> `item_kind`) | built (moved) |
| item_categories | `assets.asset_categories` (+ `assets.asset_types` folded into `item_kind` vocabulary) | built (moved) |
| documents | `assets.asset_documents` + product attachments; `product_id`/`item_id` | built (moved, reshaped) |
| movements | `inventory.stock_movements` + `assets.asset_movements` | built (merged) |
| stocks | `inventory.stock_balances` | built (renamed) |
| stock_adjustments, stock_adjustment_items | `inventory.*` | built |
| borrowing_requests | request/approval part of `assets.borrowings` | built (split) |
| borrowings | issue/return part of `assets.borrowings` | built (moved) |
| borrowing_items | `assets.borrowing_lines` | built (moved) |
| borrowing_events | `assets.borrowing_events` | built (moved) |
| maintenances | `assets.asset_maintenances` | built (moved) |
| condition_checks | `assets.asset_condition_checks` | built (moved) |
| disposals | `assets.asset_disposals` | built (moved) |
| tool_sets | `assets.tool_sets` (kit of tool units, Q37) | built (moved) |
| tool_set_items | `assets.tool_set_items` (`asset_id` -> `item_id`) | built (moved) |
| warehouses, warehouse_addresses, warehouse_storages, warehouse_managers, warehouse_organizations | `inventory.*` | built |
| warehouse_settings | new (per warehouse) | new |
| settings | new | new |
| code_numberings | `code_number.series` inventory + assets rows | new |

Removed: `assets.asset_types` (vocabulary), `assets.asset_depreciations` (-> finance),
target-only `stock_transfers(+items)`, `stock_reservations`; all `catalog.*`.

## sale (module `sale`, was `sales`)

| Table | From | Status |
|---|---|---|
| quotations, quotation_items, quotation_status_history | `sales.*` | built |
| orders, order_items, order_status_history | `sales.sales_orders`, `sales_order_items`, `order_status_history` | built (renamed) |
| delivery_notes, delivery_note_items | `sales.*` | built |
| returns, return_items | `sales.sales_returns`, `sales_return_items` | built (renamed) |
| invoices, invoice_items | `sales.*` | built |
| receipts | `sales.receipts` | built |
| discount_requests, contracts, targets | `sales.discount_requests`, `contracts`, `sales_targets` | target |
| settings | new | new |
| code_numberings | `code_number.series` sales rows | new |

Removed: `sales.payments` (legacy scaffold).

## procurement (module `procurement`)

purchase_requests, purchase_request_items, purchase_orders,
purchase_order_items, goods_receipts, goods_receipt_items, purchase_returns,
purchase_return_items - built (supplier columns re-pointed to `supplier.*`);
`code_numberings` - new. Removed: `procurement.suppliers` (-> supplier),
target-only `supplier_contacts`, `supplier_addresses`.

## finance (module `finance`, absorbs `accounting`)

| Table | From | Status |
|---|---|---|
| chart_of_accounts, journal_entries, journal_lines, accounting_periods, opening_balances, account_balances, bank_account_links, report_archives | `accounting.*` | built (moved) |
| supplier_bills, supplier_bill_items, ap_open_items, ar_open_items, payment_terms, cash_bank_accounts, cash_bank_transactions, bank_reconciliations, bank_reconciliation_items | `finance.*` | built |
| cash_bank_accounts | + `company.bank_accounts` (`invoice_usage`, `is_primary`, bank columns) | built (merged) |
| asset_depreciations | `assets.asset_depreciations` (`asset_id` -> `item_id`) | built (moved) |
| settings | planned `accounting.accounting_settings` + close-checklist state if stored | new |
| journal_templates | `accounting.journal_templates` | target |
| credit_memos, expense_claims(+items), employee_advances, expense_settlements(+items) | `finance.*` | target |
| code_numberings | `code_number.series` accounting/finance rows | new |

## tax (module `tax`, split out of `accounting`)

| Table | From | Status |
|---|---|---|
| taxes | `accounting.tax_types` | built (renamed) |
| records | `accounting.tax_records` | built (renamed) |
| corrections | `accounting.tax_corrections` | built (renamed) |
| withholding_tax_records | `accounting.withholding_tax_records` | built (moved) |
| code_numberings | tax record codes | new |

## payment (module `payment`)

| Table | From | Status |
|---|---|---|
| payments | `payment.payments` + `payment.gateway_payments` | built (merged) |
| payment_allocations | `payment.payment_allocations` (-> `payable_type`/`payable_id`) | built (reshaped) |
| gateways | new: provider config + encrypted secrets | new |
| settings | new | new |
| code_numberings | `code_number.series` payment rows | new |

## project (module `project`, was `projects`; absorbs licensing, leads, warranty)

| Table | From | Status |
|---|---|---|
| projects | `projects.projects` (+ `lead_id`, `company_id`) | built |
| tasks | `projects.project_tasks` | built (renamed) |
| evidence | `projects.project_evidence` | built (renamed) |
| costs | `projects.project_costs` | built (renamed) |
| handover | `projects.project_handover` | built (renamed) |
| leads, lead_activities, lead_attachments | `crm.*` | built (moved) |
| warranties | `aftersales.warranty_certificates` | built (moved) |
| license_applications | `licensing.licensable_applications` | built (moved) |
| license_contracts, license_keys, license_activations, license_events | `licensing.*` | built (moved) |
| license_api_keys | `licensing.application_api_keys` | built (moved) |
| addresses | new (project site address) | new |
| types | `projects.project_types` | target (`projects.type_id` added together with it) |
| phases, task_dependencies, milestones, daily_reports, site_assignments, kpi_definitions, kpi_evaluations, changes, work_plans | `projects.project_*` | target |
| settings | new | new |
| code_numberings | `code_number.series` projects/crm-lead/licensing/aftersales-warranty rows | new |

## ticket (module `ticket`, absorbs `aftersales` service tickets)

| Table | From | Status |
|---|---|---|
| tickets | `aftersales.service_tickets` (+ `ticket_type`, `parent_ticket_id`, `company_id`, `warranty_id`, `item_serial_id`, `ticket_template_id`) | built (moved) |
| ticket_messages | `aftersales.service_ticket_comments` | built (moved) |
| ticket_templates, sub_ticket_templates | new | new |
| settings | new | new |
| code_numberings | `code_number.series` aftersales ticket rows | new |

Removed: the target-only `ticket.*` tables of today's dbml and every
target-only `aftersales.*` table.

## human_resource (module `human-resource`, was `hr`)

| Table | From | Status |
|---|---|---|
| employees | `hr.employees` | built |
| employee_addresses | `hr.employee_addresses` | target (reshaped to `village_id` only, Q10) |
| attendances | `hr.attendance_records` | built (renamed) |
| leave_types, leave_requests, overtime_requests | `hr.*` | built |
| employee_tasks | `hr.employee_tasks` | built |
| employee_salaries | new (Q39): base salary, fixed allowances, salary bank account (absorbs `hr.bank_accounts`), effective_from/to | built (reshaped) |
| employee_salary_records | `hr.salary_summaries` (Q39) | built (renamed) |
| schedules | new (shift per employee per date) | target |
| settings | new | new |
| code_numberings | `code_number.series` hr rows | new |

Removed: `hr.bank_accounts` (folded into `employee_salaries`); all other
target-only `hr.*`.

## document (module `document`)

templates, documents, files, signatures, signature_requests, user_signatures,
access_logs, shares, tags, tag_links - built, unchanged. `settings`,
`code_numberings` - new.

## notification (module `notification`)

| Table | From | Status |
|---|---|---|
| push_notifications | `notification.notifications` | built (renamed) |
| push_notification_templates | `notification.notification_templates` | built (renamed) |

## webhook (module `webhook`, no schema - Q38)

No tables. Receives provider callbacks under `/webhooks/<provider>` and hands
them to the owning modules' exported services. See `modules/webhook.md`.

## audit, automation (unchanged modules)

`audit.audit_logs`; `automation.outbox_messages`, `faq_entries`,
`whatsapp_conversations`, `whatsapp_messages` - built, unchanged except the
logical references re-pointed (`whatsapp_conversations.lead_id` ->
`project.leads.id`). Target-only automation tables (integrations, workflows,
scheduled jobs) are removed from `docs.dbml`.

## Logical references re-pointed (all modules)

| Old target | New target |
|---|---|
| `crm.customers.id` | `customer.customers.id` and/or `customer.companies.id` (documents carry both, nullable) |
| `crm.customer_contacts.id` | `customer.customers.id` |
| `crm.leads.id` | `project.leads.id` |
| `procurement.suppliers.id` | `supplier.companies.id` (+ `supplier.suppliers.id` for the PIC) |
| `inventory.items.id` (SKU) | `inventory.products.id` (column renamed `product_id`) |
| `assets.assets.id` | `inventory.items.id` |
| `inventory.serial_tracked_items.id` | `inventory.item_serials.id` |
| `inventory.stock_movements.id` | `inventory.movements.id` |
| `catalog.items.*`, `catalog.units.*` | `inventory.products.id` / unit label |
| `sales.*` | `sale.*` (renamed tables per the sale section) |
| `accounting.*` | `finance.*` / `tax.*` |
| `projects.*` | `project.*` |
| `aftersales.service_tickets.id` | `ticket.tickets.id` |
| `aftersales.warranty_certificates.id` | `project.warranties.id` |
| `licensing.*` | `project.license_*` |
| `hr.employees.id` | `human_resource.employees.id` |
| `hr.bank_accounts.id` | `human_resource.employee_salaries.id` |
| `organization.departments/positions/branches/cost_centers.id` | dropped (columns removed) |
| `auth.portal_identities.id` | `customer.customers.id` |
| `payment.gateway_payments.id` | `payment.payments.id` |
| `notification.notification_templates.id` | `notification.push_notification_templates.id` |
