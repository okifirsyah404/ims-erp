# Logical References

Companion to `docs.dbml` (canonical). Every cross-module link in the ERP,
where a foreign key is forbidden by the module isolation rule.

## What a logical reference is

A **logical reference** is a plain id column that points at a row owned by
another module. It is written as a column note in `docs.dbml`, always with the
same wording:

```text
Logical reference to <target>.id. Cross-module FK intentionally omitted.
Validated through the <Module> module contract.
```

Example from `docs.dbml`:

```dbml
Table crm.customers {
  id uuid [pk, default: `uuidv7()`]
  organization_id text [not null, note: "Logical reference to auth.organizations.id. Cross-module FK intentionally omitted. Validated through the Identity module contract."]
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
3. **Nullability follows the business rule.** `not null` means the link is
   mandatory for the record to be valid; nullable means the link is optional.
   ADR-0014 makes every cross-module reference nullable: presence is a
   service-layer fact, enforced by the owning module's contract method, not
   by the database. The `not null` form is the pre-ADR-0014 state and is
   removed by ERP-0037.
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
| Logical reference columns | 521 |
| Distinct targets | 41 |
| Cross-module `Ref:` declarations | 0 |
| Intra-module `Ref:` declarations | 233 |

Counts are re-derived on every run of `validate-dbml.ts`, which parses
`docs.dbml` with `@dbml/core` and fails the run if a `Ref:` crosses a module
boundary. This document is regenerated with `gen-logical-references.ts`.

## Distribution of the referring columns per target

| Target | Owner | Referring columns |
|---|---|---|
| `auth.organizations.id` | Identity | 185 || `auth.users.id` | Identity | 173 || `hr.employees.id` | HR | 19 || `crm.customers.id` | CRM | 18 || `document.documents.id` | Document | 17 || `catalog.items.id` | Catalog | 10 || `location.villages.id` | Location | 9 || `projects.projects.id` | Projects | 8 || `inventory.warehouses.id` | Inventory | 7 || `inventory.items.id` | Inventory | 6 || `inventory.warehouse_storages.id` | Inventory | 6 || `location.districts.id` | Location | 5 || `location.provinces.id` | Location | 5 || `location.regencies.id` | Location | 5 || `organization.departments.id` | Organization | 5 || `procurement.suppliers.id` | Procurement | 4 || `crm.customer_contacts.id` | CRM | 3 || `organization.positions.id` | Organization | 3 || `sales.invoices.id` | Sales | 3 || `sales.sales_orders.id` | Sales | 3 || `auth.portal_identities.id` | Identity | 2 || `finance.payments.id` | Finance | 2 || `inventory.stock_movements.id` | Inventory | 2 || `organization.branches.id` | Organization | 2 || `organization.cost_centers.id` | Organization | 2 || `procurement.purchase_orders.id` | Procurement | 2 || `accounting.chart_of_accounts.id` | Accounting | 1 || `accounting.journal_entries.id` | Accounting | 1 || `aftersales.service_tickets.id` | After-Sales | 1 || `assets.assets.id` | Assets | 1 || `catalog.item_categories.id` | Catalog | 1 || `catalog.item_variants.id` | Catalog | 1 || `catalog.units.id` | Catalog | 1 || `crm.customer_groups.id` | CRM | 1 || `crm.leads.id` | CRM | 1 || `finance.cash_bank_accounts.id` | Finance | 1 || `finance.cash_bank_transactions.id` | Finance | 1 || `finance.payment_terms.id` | Finance | 1 || `hr.bank_accounts.id` | HR | 1 || `payroll.salary_components.id` | Payroll | 1 || `projects.project_handover.id` | Projects | 1 |
## The 41 targets in full

### `auth.organizations.id` - owner Identity, 185 referring columns

- `accounting.account_balances`  ->  `organization_id`
- `accounting.accounting_periods`  ->  `organization_id`
- `accounting.accounting_settings`  ->  `organization_id`
- `accounting.bank_account_links`  ->  `organization_id`
- `accounting.chart_of_accounts`  ->  `organization_id`
- `accounting.journal_entries`  ->  `organization_id`
- `accounting.journal_lines`  ->  `organization_id`
- `accounting.journal_templates`  ->  `organization_id`
- `accounting.opening_balances`  ->  `organization_id`
- `accounting.tax_corrections`  ->  `organization_id`
- `accounting.tax_records`  ->  `organization_id`
- `accounting.tax_types`  ->  `organization_id`
- `accounting.withholding_tax_records`  ->  `organization_id`
- `aftersales.maintenance_plans`  ->  `organization_id`
- `aftersales.maintenance_schedules`  ->  `organization_id`
- `aftersales.maintenance_visit_tasks`  ->  `organization_id`
- `aftersales.maintenance_visits`  ->  `organization_id`
- `aftersales.satisfaction_surveys`  ->  `organization_id`
- `aftersales.service_contracts`  ->  `organization_id`
- `aftersales.service_parts_usage`  ->  `organization_id`
- `aftersales.service_technicians`  ->  `organization_id`
- `aftersales.service_ticket_comments`  ->  `organization_id`
- `aftersales.service_work_orders`  ->  `organization_id`
- `aftersales.sla_policies`  ->  `organization_id`
- `aftersales.spare_parts`  ->  `organization_id`
- `aftersales.warranty_claims`  ->  `organization_id`
- `aftersales.warranty_policies`  ->  `organization_id`
- `approval.approval_decisions`  ->  `organization_id`
- `approval.approval_delegations`  ->  `organization_id`
- `approval.approval_policies`  ->  `organization_id`
- `approval.approval_policy_versions`  ->  `organization_id`
- `approval.approval_requests`  ->  `organization_id`
- `approval.approval_stages`  ->  `organization_id`
- `approval.approval_thresholds`  ->  `organization_id`
- `assets.asset_categories`  ->  `organization_id`
- `assets.asset_condition_checks`  ->  `organization_id`
- `assets.asset_depreciations`  ->  `organization_id`
- `assets.asset_disposals`  ->  `organization_id`
- `assets.asset_documents`  ->  `organization_id`
- `assets.asset_maintenances`  ->  `organization_id`
- `assets.asset_movements`  ->  `organization_id`
- `assets.assets`  ->  `organization_id`
- `assets.tool_set_items`  ->  `organization_id`
- `assets.tool_sets`  ->  `organization_id`
- `automation.integration_credentials`  ->  `organization_id`
- `automation.integrations`  ->  `organization_id`
- `automation.job_executions`  ->  `organization_id`
- `automation.outbox_messages`  ->  `organization_id`
- `automation.scheduled_jobs`  ->  `organization_id`
- `automation.workflow_runs`  ->  `organization_id`
- `automation.workflow_step_runs`  ->  `organization_id`
- `automation.workflow_steps`  ->  `organization_id`
- `automation.workflows`  ->  `organization_id`
- `budgeting.budget_executions`  ->  `organization_id`
- `budgeting.budget_items`  ->  `organization_id`
- `budgeting.budget_periods`  ->  `organization_id`
- `budgeting.budget_revision_items`  ->  `organization_id`
- `budgeting.budget_revisions`  ->  `organization_id`
- `budgeting.budgets`  ->  `organization_id`
- `budgeting.cash_flow_items`  ->  `organization_id`
- `budgeting.cash_flow_plans`  ->  `organization_id`
- `catalog.item_attributes`  ->  `organization_id`
- `catalog.item_bundles`  ->  `organization_id`
- `catalog.item_categories`  ->  `organization_id`
- `catalog.item_cost_histories`  ->  `organization_id`
- `catalog.item_documents`  ->  `organization_id`
- `catalog.item_prices`  ->  `organization_id`
- `catalog.item_suppliers`  ->  `organization_id`
- `catalog.item_uom_conversions`  ->  `organization_id`
- `catalog.item_variants`  ->  `organization_id`
- `catalog.items`  ->  `organization_id`
- `catalog.price_lists`  ->  `organization_id`
- `catalog.units`  ->  `organization_id`
- `commerce.catalog_publication_items`  ->  `organization_id`
- `commerce.catalog_publications`  ->  `organization_id`
- `commerce.commerce_order_items`  ->  `organization_id`
- `commerce.commerce_orders`  ->  `organization_id`
- `commerce.promotion_rules`  ->  `organization_id`
- `commerce.promotions`  ->  `organization_id`
- `commerce.web_menu_items`  ->  `organization_id`
- `commerce.web_menus`  ->  `organization_id`
- `commerce.web_pages`  ->  `organization_id`
- `crm.customer_addresses`  ->  `organization_id`
- `crm.customer_credit_limits`  ->  `organization_id`
- `crm.customer_groups`  ->  `organization_id`
- `crm.customer_interactions`  ->  `organization_id`
- `crm.customer_segment_members`  ->  `organization_id`
- `crm.customer_segments`  ->  `organization_id`
- `finance.ap_open_items`  ->  `organization_id`
- `finance.ar_open_items`  ->  `organization_id`
- `finance.bank_reconciliation_items`  ->  `organization_id`
- `finance.bank_reconciliations`  ->  `organization_id`
- `finance.cash_bank_accounts`  ->  `organization_id`
- `finance.cash_bank_transactions`  ->  `organization_id`
- `finance.credit_memos`  ->  `organization_id`
- `finance.employee_advances`  ->  `organization_id`
- `finance.expense_claim_items`  ->  `organization_id`
- `finance.expense_claims`  ->  `organization_id`
- `finance.expense_settlement_items`  ->  `organization_id`
- `finance.expense_settlements`  ->  `organization_id`
- `finance.payment_allocations`  ->  `organization_id`
- `finance.payment_terms`  ->  `organization_id`
- `finance.payments`  ->  `organization_id`
- `finance.supplier_bills`  ->  `organization_id`
- `hr.attendance_corrections`  ->  `organization_id`
- `hr.attendance_records`  ->  `organization_id`
- `hr.bank_accounts`  ->  `organization_id`
- `hr.certifications`  ->  `organization_id`
- `hr.disciplinary_records`  ->  `organization_id`
- `hr.employee_addresses`  ->  `organization_id`
- `hr.employee_documents`  ->  `organization_id`
- `hr.employee_emergencies`  ->  `organization_id`
- `hr.employee_salary_components`  ->  `organization_id`
- `hr.employee_transfers`  ->  `organization_id`
- `hr.employees`  ->  `organization_id`
- `hr.employment_contracts`  ->  `organization_id`
- `hr.leave_requests`  ->  `organization_id`
- `hr.leave_types`  ->  `organization_id`
- `hr.separation_records`  ->  `organization_id`
- `hr.training_records`  ->  `organization_id`
- `inventory.stock_adjustment_items`  ->  `organization_id`
- `inventory.stock_adjustments`  ->  `organization_id`
- `inventory.stock_reservations`  ->  `organization_id`
- `inventory.stock_transfer_items`  ->  `organization_id`
- `inventory.stock_transfers`  ->  `organization_id`
- `inventory.warehouse_organizations`  ->  `organization_id`
- `investor.capital_commitments`  ->  `organization_id`
- `investor.capital_deposits`  ->  `organization_id`
- `investor.fund_allocations`  ->  `organization_id`
- `investor.investor_addresses`  ->  `organization_id`
- `investor.investor_meetings`  ->  `organization_id`
- `investor.investor_reports`  ->  `organization_id`
- `investor.investors`  ->  `organization_id`
- `investor.profit_distribution_runs`  ->  `organization_id`
- `investor.profit_share_scheme_entries`  ->  `organization_id`
- `investor.profit_share_schemes`  ->  `organization_id`
- `investor.profit_shares`  ->  `organization_id`
- `licensing.license_entitlement_usages`  ->  `organization_id`
- `licensing.license_entitlements`  ->  `organization_id`
- `licensing.license_packages`  ->  `organization_id`
- `licensing.subscription_schedules`  ->  `organization_id`
- `organization.branches`  ->  `organization_id`
- `organization.cost_centers`  ->  `organization_id`
- `organization.departments`  ->  `organization_id`
- `organization.fiscal_settings`  ->  `organization_id`
- `organization.positions`  ->  `organization_id`
- `organization.settings`  ->  `organization_id`
- `payroll.bpjs_registrations`  ->  `organization_id`
- `payroll.payroll_adjustments`  ->  `organization_id`
- `payroll.payroll_inputs`  ->  `organization_id`
- `payroll.payroll_payment_items`  ->  `organization_id`
- `payroll.payroll_payments`  ->  `organization_id`
- `payroll.payroll_periods`  ->  `organization_id`
- `payroll.payroll_runs`  ->  `organization_id`
- `payroll.payslip_acknowledgements`  ->  `organization_id`
- `payroll.payslip_items`  ->  `organization_id`
- `payroll.payslips`  ->  `organization_id`
- `payroll.salary_components`  ->  `organization_id`
- `procurement.purchase_requests`  ->  `organization_id`
- `procurement.purchase_return_items`  ->  `organization_id`
- `procurement.purchase_returns`  ->  `organization_id`
- `procurement.supplier_addresses`  ->  `organization_id`
- `procurement.supplier_contacts`  ->  `organization_id`
- `projects.project_changes`  ->  `organization_id`
- `projects.project_daily_reports`  ->  `organization_id`
- `projects.project_kpi_definitions`  ->  `organization_id`
- `projects.project_kpi_evaluations`  ->  `organization_id`
- `projects.project_milestones`  ->  `organization_id`
- `projects.project_phases`  ->  `organization_id`
- `projects.project_site_assignments`  ->  `organization_id`
- `projects.project_task_dependencies`  ->  `organization_id`
- `projects.project_types`  ->  `organization_id`
- `projects.project_work_plans`  ->  `organization_id`
- `sales.contracts`  ->  `organization_id`
- `sales.discount_requests`  ->  `organization_id`
- `sales.invoice_items`  ->  `organization_id`
- `sales.invoices`  ->  `organization_id`
- `sales.receipts`  ->  `organization_id`
- `sales.sales_returns`  ->  `organization_id`
- `sales.sales_targets`  ->  `organization_id`
- `ticket.ticket_attachments`  ->  `organization_id`
- `ticket.ticket_categories`  ->  `organization_id`
- `ticket.ticket_messages`  ->  `organization_id`
- `ticket.ticket_status_history`  ->  `organization_id`
- `ticket.tickets`  ->  `organization_id`

### `auth.users.id` - owner Identity, 173 referring columns

- `accounting.accounting_periods`  ->  `closed_by`
- `accounting.accounting_periods`  ->  `reopened_by`
- `accounting.journal_entries`  ->  `approved_by`
- `accounting.journal_entries`  ->  `posted_by`
- `accounting.journal_entries`  ->  `prepared_by`
- `accounting.tax_corrections`  ->  `created_by`
- `accounting.tax_records`  ->  `verified_by`
- `aftersales.service_ticket_comments`  ->  `author_user_id`
- `aftersales.service_tickets`  ->  `assignee_user_id`
- `aftersales.service_tickets`  ->  `closed_by`
- `aftersales.service_tickets`  ->  `created_by`
- `aftersales.service_tickets`  ->  `resolved_by`
- `aftersales.warranty_certificates`  ->  `created_by`
- `aftersales.warranty_claims`  ->  `approved_by`
- `approval.approval_decisions`  ->  `approver_user_id`
- `approval.approval_delegations`  ->  `created_by_user_id`
- `approval.approval_delegations`  ->  `from_user_id`
- `approval.approval_delegations`  ->  `to_user_id`
- `approval.approval_policies`  ->  `created_by_user_id`
- `approval.approval_policy_versions`  ->  `created_by_user_id`
- `approval.approval_requests`  ->  `requested_by_user_id`
- `assets.asset_condition_checks`  ->  `checked_by_user_id`
- `assets.asset_disposals`  ->  `approved_by`
- `assets.asset_disposals`  ->  `requested_by`
- `assets.asset_movements`  ->  `moved_by_user_id`
- `assets.borrowings`  ->  `borrower_user_id`
- `audit.audit_logs`  ->  `actor_user_id`
- `auth.user_role_assignments`  ->  `granted_by`
- `automation.integrations`  ->  `created_by_user_id`
- `automation.job_executions`  ->  `triggered_by_user_id`
- `automation.workflow_runs`  ->  `initiated_by_user_id`
- `automation.workflows`  ->  `created_by_user_id`
- `budgeting.budget_revisions`  ->  `approved_by_user_id`
- `budgeting.budget_revisions`  ->  `requested_by_user_id`
- `budgeting.budgets`  ->  `approved_by_user_id`
- `budgeting.budgets`  ->  `submitted_by_user_id`
- `code_number.series`  ->  `updated_by`
- `commerce.catalog_publications`  ->  `published_by_user_id`
- `commerce.promotions`  ->  `created_by_user_id`
- `company.profiles`  ->  `updated_by`
- `company.settings`  ->  `updated_by`
- `crm.customer_credit_limits`  ->  `approved_by_user_id`
- `crm.customer_interactions`  ->  `handled_by_user_id`
- `crm.customer_segment_members`  ->  `added_by`
- `crm.customers`  ->  `created_by`
- `crm.customers`  ->  `owner_user_id`
- `crm.lead_activities`  ->  `created_by`
- `crm.leads`  ->  `created_by`
- `document.access_logs`  ->  `accessed_by_user_id`
- `document.documents`  ->  `approved_by_user_id`
- `document.documents`  ->  `issued_by_user_id`
- `document.files`  ->  `uploaded_by_user_id`
- `document.shares`  ->  `shared_by_user_id`
- `document.signatures`  ->  `signer_user_id`
- `finance.bank_reconciliations`  ->  `reconciled_by`
- `finance.cash_bank_transactions`  ->  `posted_by`
- `finance.credit_memos`  ->  `issued_by`
- `finance.employee_advances`  ->  `approved_by`
- `finance.employee_advances`  ->  `requested_by`
- `finance.expense_claims`  ->  `approved_by`
- `finance.expense_claims`  ->  `submitted_by`
- `finance.expense_settlements`  ->  `approved_by`
- `finance.expense_settlements`  ->  `submitted_by`
- `finance.expense_settlements`  ->  `verified_by`
- `finance.payments`  ->  `approved_by`
- `finance.payments`  ->  `executed_by`
- `finance.payments`  ->  `requested_by`
- `finance.supplier_bills`  ->  `approved_by`
- `hr.attendance_corrections`  ->  `approved_by`
- `hr.attendance_corrections`  ->  `requested_by`
- `hr.disciplinary_records`  ->  `approved_by`
- `hr.disciplinary_records`  ->  `reported_by`
- `hr.employee_transfers`  ->  `approved_by`
- `hr.employee_transfers`  ->  `requested_by`
- `hr.employees`  ->  `user_id`
- `hr.employment_contracts`  ->  `approved_by`
- `hr.leave_requests`  ->  `approved_by`
- `hr.leave_requests`  ->  `requested_by`
- `hr.separation_records`  ->  `approved_by`
- `inventory.items`  ->  `created_by`
- `inventory.stock_adjustments`  ->  `approved_by`
- `inventory.stock_adjustments`  ->  `requested_by`
- `inventory.stock_movements`  ->  `created_by`
- `inventory.stock_transfers`  ->  `approved_by`
- `inventory.stock_transfers`  ->  `requested_by`
- `investor.capital_commitments`  ->  `approved_by_user_id`
- `investor.capital_deposits`  ->  `verified_by_user_id`
- `investor.fund_allocations`  ->  `approved_by_user_id`
- `investor.fund_allocations`  ->  `submitted_by_user_id`
- `investor.investor_reports`  ->  `published_by_user_id`
- `investor.profit_distribution_runs`  ->  `approved_by_user_id`
- `investor.profit_distribution_runs`  ->  `calculated_by_user_id`
- `licensing.application_api_keys`  ->  `created_by`
- `licensing.application_api_keys`  ->  `revoked_by`
- `licensing.licensable_applications`  ->  `created_by`
- `licensing.license_activations`  ->  `deactivated_by`
- `licensing.license_contracts`  ->  `activated_by`
- `licensing.license_contracts`  ->  `created_by`
- `licensing.license_contracts`  ->  `terminated_by`
- `licensing.license_events`  ->  `actor_user_id`
- `licensing.license_keys`  ->  `created_by`
- `licensing.license_keys`  ->  `revoked_by`
- `notification.notifications`  ->  `user_id`
- `organization.departments`  ->  `manager_user_id`
- `organization.settings`  ->  `updated_by`
- `payroll.payroll_adjustments`  ->  `approved_by`
- `payroll.payroll_adjustments`  ->  `requested_by`
- `payroll.payroll_inputs`  ->  `created_by`
- `payroll.payroll_payments`  ->  `executed_by`
- `payroll.payroll_periods`  ->  `closed_by`
- `payroll.payroll_runs`  ->  `approved_by`
- `payroll.payroll_runs`  ->  `calculated_by`
- `payroll.payroll_runs`  ->  `submitted_by`
- `procurement.goods_receipts`  ->  `received_by`
- `procurement.purchase_orders`  ->  `approved_by`
- `procurement.purchase_orders`  ->  `cancelled_by`
- `procurement.purchase_orders`  ->  `created_by`
- `procurement.purchase_orders`  ->  `sent_by`
- `procurement.purchase_orders`  ->  `submitted_by`
- `procurement.purchase_requests`  ->  `approved_by`
- `procurement.purchase_requests`  ->  `cancelled_by`
- `procurement.purchase_requests`  ->  `requested_by`
- `procurement.purchase_returns`  ->  `approved_by`
- `procurement.suppliers`  ->  `created_by`
- `projects.project_changes`  ->  `approved_by`
- `projects.project_changes`  ->  `requested_by`
- `projects.project_costs`  ->  `created_by`
- `projects.project_costs`  ->  `voided_by`
- `projects.project_daily_reports`  ->  `verified_by`
- `projects.project_evidence`  ->  `deleted_by`
- `projects.project_evidence`  ->  `uploaded_by`
- `projects.project_handover`  ->  `cancelled_by`
- `projects.project_handover`  ->  `created_by`
- `projects.project_kpi_evaluations`  ->  `evaluated_by`
- `projects.project_milestones`  ->  `verified_by`
- `projects.project_tasks`  ->  `assignee_user_id`
- `projects.project_tasks`  ->  `created_by`
- `projects.project_tasks`  ->  `deleted_by`
- `projects.project_tasks`  ->  `done_by`
- `projects.project_work_plans`  ->  `approved_by`
- `projects.project_work_plans`  ->  `owner_user_id`
- `projects.projects`  ->  `cancelled_by`
- `projects.projects`  ->  `closed_by`
- `projects.projects`  ->  `created_by`
- `projects.projects`  ->  `pic_user_id`
- `sales.delivery_notes`  ->  `cancelled_by`
- `sales.delivery_notes`  ->  `created_by`
- `sales.delivery_notes`  ->  `shipped_by`
- `sales.discount_requests`  ->  `approved_by`
- `sales.discount_requests`  ->  `requested_by`
- `sales.invoices`  ->  `approved_by`
- `sales.invoices`  ->  `created_by`
- `sales.invoices`  ->  `issued_by`
- `sales.invoices`  ->  `voided_by`
- `sales.order_status_history`  ->  `changed_by`
- `sales.quotation_status_history`  ->  `changed_by`
- `sales.quotations`  ->  `approved_by`
- `sales.quotations`  ->  `closed_by`
- `sales.quotations`  ->  `created_by`
- `sales.quotations`  ->  `sent_by`
- `sales.receipts`  ->  `received_by`
- `sales.receipts`  ->  `reversed_by`
- `sales.sales_orders`  ->  `cancelled_by`
- `sales.sales_orders`  ->  `created_by`
- `sales.sales_orders`  ->  `sales_person_user_id`
- `sales.sales_returns`  ->  `approved_by`
- `sales.sales_targets`  ->  `assigned_by`
- `sales.sales_targets`  ->  `sales_user_id`
- `ticket.ticket_attachments`  ->  `uploaded_by`
- `ticket.ticket_messages`  ->  `author_user_id`
- `ticket.ticket_status_history`  ->  `changed_by`
- `ticket.tickets`  ->  `assignee_user_id`
- `ticket.tickets`  ->  `created_by`

### `hr.employees.id` - owner HR, 19 referring columns

- `aftersales.maintenance_schedules`  ->  `default_assignee_employee_id`
- `aftersales.maintenance_visits`  ->  `technician_employee_id`
- `aftersales.service_technicians`  ->  `employee_id`
- `aftersales.service_work_orders`  ->  `assigned_to_employee_id`
- `assets.asset_maintenances`  ->  `performed_by_employee_id`
- `assets.tool_sets`  ->  `custodian_employee_id`
- `auth.user_profiles`  ->  `employee_id`
- `finance.employee_advances`  ->  `employee_id`
- `finance.expense_claims`  ->  `employee_id`
- `finance.expense_settlements`  ->  `employee_id`
- `payroll.bpjs_registrations`  ->  `employee_id`
- `payroll.payroll_adjustments`  ->  `employee_id`
- `payroll.payroll_inputs`  ->  `employee_id`
- `payroll.payroll_payment_items`  ->  `employee_id`
- `payroll.payslip_acknowledgements`  ->  `employee_id`
- `payroll.payslips`  ->  `employee_id`
- `projects.project_daily_reports`  ->  `technician_employee_id`
- `projects.project_kpi_evaluations`  ->  `employee_id`
- `projects.project_site_assignments`  ->  `employee_id`

### `crm.customers.id` - owner CRM, 18 referring columns

- `aftersales.maintenance_plans`  ->  `customer_id`
- `aftersales.satisfaction_surveys`  ->  `customer_id`
- `aftersales.service_contracts`  ->  `customer_id`
- `aftersales.service_tickets`  ->  `customer_id`
- `aftersales.warranty_certificates`  ->  `customer_id`
- `aftersales.warranty_claims`  ->  `customer_id`
- `assets.borrowings`  ->  `borrower_customer_id`
- `commerce.commerce_orders`  ->  `customer_id`
- `finance.ar_open_items`  ->  `customer_id`
- `finance.credit_memos`  ->  `customer_id`
- `licensing.license_contracts`  ->  `customer_id`
- `projects.projects`  ->  `customer_id`
- `sales.contracts`  ->  `customer_id`
- `sales.invoices`  ->  `customer_id`
- `sales.quotations`  ->  `customer_id`
- `sales.sales_orders`  ->  `customer_id`
- `sales.sales_returns`  ->  `customer_id`
- `ticket.tickets`  ->  `customer_id`

### `document.documents.id` - owner Document, 17 referring columns

- `accounting.tax_corrections`  ->  `evidence_document_id`
- `aftersales.service_contracts`  ->  `document_id`
- `assets.asset_documents`  ->  `document_id`
- `assets.asset_maintenances`  ->  `document_id`
- `assets.assets`  ->  `document_id`
- `catalog.item_documents`  ->  `document_id`
- `finance.expense_claim_items`  ->  `receipt_document_id`
- `finance.expense_settlement_items`  ->  `receipt_document_id`
- `hr.certifications`  ->  `document_id`
- `hr.employee_documents`  ->  `document_id`
- `hr.employment_contracts`  ->  `document_id`
- `hr.training_records`  ->  `document_id`
- `investor.investor_meetings`  ->  `document_id`
- `investor.investor_reports`  ->  `document_id`
- `payroll.payroll_payments`  ->  `proof_document_id`
- `payroll.payslips`  ->  `document_id`
- `sales.contracts`  ->  `document_id`

### `catalog.items.id` - owner Catalog, 10 referring columns

- `aftersales.service_parts_usage`  ->  `item_id`
- `aftersales.spare_parts`  ->  `item_id`
- `aftersales.warranty_claims`  ->  `item_id`
- `aftersales.warranty_policies`  ->  `item_id`
- `budgeting.budget_items`  ->  `item_id`
- `commerce.catalog_publication_items`  ->  `item_id`
- `commerce.commerce_order_items`  ->  `item_id`
- `commerce.promotion_rules`  ->  `item_id`
- `procurement.purchase_return_items`  ->  `item_id`
- `sales.invoice_items`  ->  `item_id`

### `location.villages.id` - owner Location, 9 referring columns

- `company.head_office_addresses`  ->  `village_id`
- `crm.customer_addresses`  ->  `village_id`
- `crm.customers`  ->  `village_id`
- `hr.employee_addresses`  ->  `village_id`
- `inventory.warehouse_addresses`  ->  `village_id`
- `investor.investor_addresses`  ->  `village_id`
- `investor.investors`  ->  `village_id`
- `procurement.supplier_addresses`  ->  `village_id`
- `procurement.suppliers`  ->  `village_id`

### `projects.projects.id` - owner Projects, 8 referring columns

- `accounting.journal_lines`  ->  `project_id`
- `aftersales.service_tickets`  ->  `project_id`
- `aftersales.warranty_certificates`  ->  `project_id`
- `assets.borrowing_lines`  ->  `project_id`
- `budgeting.budgets`  ->  `project_id`
- `finance.employee_advances`  ->  `project_id`
- `finance.expense_settlement_items`  ->  `project_id`
- `finance.expense_settlements`  ->  `project_id`

### `inventory.warehouses.id` - owner Inventory (warehouse schema), 7 referring columns

- `aftersales.spare_parts`  ->  `warehouse_id`
- `assets.asset_movements`  ->  `from_warehouse_id`
- `assets.asset_movements`  ->  `to_warehouse_id`
- `assets.assets`  ->  `warehouse_id`
- `assets.borrowing_lines`  ->  `origin_warehouse_id`
- `procurement.goods_receipts`  ->  `warehouse_id`
- `sales.delivery_notes`  ->  `warehouse_id`

### `inventory.items.id` - owner Inventory (warehouse schema), 6 referring columns

- `procurement.goods_receipt_items`  ->  `item_id`
- `procurement.purchase_order_items`  ->  `item_id`
- `procurement.purchase_request_items`  ->  `item_id`
- `sales.delivery_note_items`  ->  `item_id`
- `sales.quotation_items`  ->  `item_id`
- `sales.sales_order_items`  ->  `item_id`

### `inventory.warehouse_storages.id` - owner Inventory (warehouse schema), 6 referring columns

- `assets.asset_movements`  ->  `from_storage_id`
- `assets.asset_movements`  ->  `to_storage_id`
- `assets.assets`  ->  `storage_id`
- `assets.borrowing_lines`  ->  `origin_storage_id`
- `procurement.goods_receipts`  ->  `bin_id`
- `sales.delivery_notes`  ->  `bin_id`

### `location.districts.id` - owner Location, 5 referring columns

- `crm.customer_addresses`  ->  `district_id`
- `hr.employee_addresses`  ->  `district_id`
- `investor.investor_addresses`  ->  `district_id`
- `investor.investors`  ->  `district_id`
- `procurement.supplier_addresses`  ->  `district_id`

### `location.provinces.id` - owner Location, 5 referring columns

- `crm.customer_addresses`  ->  `province_id`
- `hr.employee_addresses`  ->  `province_id`
- `investor.investor_addresses`  ->  `province_id`
- `investor.investors`  ->  `province_id`
- `procurement.supplier_addresses`  ->  `province_id`

### `location.regencies.id` - owner Location, 5 referring columns

- `crm.customer_addresses`  ->  `regency_id`
- `hr.employee_addresses`  ->  `regency_id`
- `investor.investor_addresses`  ->  `regency_id`
- `investor.investors`  ->  `regency_id`
- `procurement.supplier_addresses`  ->  `regency_id`

### `organization.departments.id` - owner Organization, 5 referring columns

- `budgeting.budgets`  ->  `department_id`
- `finance.expense_claims`  ->  `department_id`
- `hr.employee_transfers`  ->  `from_department_id`
- `hr.employee_transfers`  ->  `to_department_id`
- `hr.employees`  ->  `department_id`

### `procurement.suppliers.id` - owner Procurement, 4 referring columns

- `assets.assets`  ->  `supplier_id`
- `catalog.item_suppliers`  ->  `supplier_id`
- `finance.ap_open_items`  ->  `supplier_id`
- `finance.supplier_bills`  ->  `supplier_id`

### `crm.customer_contacts.id` - owner CRM, 3 referring columns

- `sales.quotations`  ->  `customer_contact_id`
- `ticket.ticket_messages`  ->  `author_contact_id`
- `ticket.tickets`  ->  `contact_id`

### `organization.positions.id` - owner Organization, 3 referring columns

- `hr.employee_transfers`  ->  `from_position_id`
- `hr.employee_transfers`  ->  `to_position_id`
- `hr.employees`  ->  `position_id`

### `sales.invoices.id` - owner Sales, 3 referring columns

- `aftersales.warranty_claims`  ->  `invoice_id`
- `finance.ar_open_items`  ->  `sales_invoice_id`
- `finance.payments`  ->  `sales_invoice_id`

### `sales.sales_orders.id` - owner Sales, 3 referring columns

- `aftersales.warranty_claims`  ->  `sales_order_id`
- `licensing.license_contracts`  ->  `sales_order_id`
- `projects.projects`  ->  `sales_order_id`

### `auth.portal_identities.id` - owner Identity, 2 referring columns

- `crm.customers`  ->  `portal_identity_id`
- `investor.investors`  ->  `portal_identity_id`

### `finance.payments.id` - owner Finance, 2 referring columns

- `investor.profit_shares`  ->  `payment_id`
- `sales.receipts`  ->  `payment_id`

### `inventory.stock_movements.id` - owner Inventory (warehouse schema), 2 referring columns

- `procurement.goods_receipt_items`  ->  `stock_movement_id`
- `sales.delivery_note_items`  ->  `stock_movement_id`

### `organization.branches.id` - owner Organization, 2 referring columns

- `budgeting.budgets`  ->  `branch_id`
- `hr.employees`  ->  `branch_id`

### `organization.cost_centers.id` - owner Organization, 2 referring columns

- `accounting.journal_lines`  ->  `cost_center_id`
- `hr.employees`  ->  `cost_center_id`

### `procurement.purchase_orders.id` - owner Procurement, 2 referring columns

- `assets.assets`  ->  `purchase_order_id`
- `finance.supplier_bills`  ->  `purchase_order_id`

### `accounting.chart_of_accounts.id` - owner Accounting, 1 referring column

- `budgeting.budget_items`  ->  `chart_of_account_id`

### `accounting.journal_entries.id` - owner Accounting, 1 referring column

- `assets.asset_depreciations`  ->  `journal_entry_id`

### `aftersales.service_tickets.id` - owner After-Sales, 1 referring column

- `ticket.tickets`  ->  `escalated_service_ticket_id`

### `assets.assets.id` - owner Assets, 1 referring column

- `aftersales.maintenance_plans`  ->  `asset_id`

### `catalog.item_categories.id` - owner Catalog, 1 referring column

- `commerce.promotion_rules`  ->  `item_category_id`

### `catalog.item_variants.id` - owner Catalog, 1 referring column

- `sales.invoice_items`  ->  `item_variant_id`

### `catalog.units.id` - owner Catalog, 1 referring column

- `sales.invoice_items`  ->  `unit_id`

### `crm.customer_groups.id` - owner CRM, 1 referring column

- `catalog.price_lists`  ->  `customer_group_id`

### `crm.leads.id` - owner CRM, 1 referring column

- `sales.quotations`  ->  `lead_id`

### `finance.cash_bank_accounts.id` - owner Finance, 1 referring column

- `accounting.bank_account_links`  ->  `cash_bank_account_id`

### `finance.cash_bank_transactions.id` - owner Finance, 1 referring column

- `investor.capital_deposits`  ->  `cash_bank_transaction_id`

### `finance.payment_terms.id` - owner Finance, 1 referring column

- `sales.invoices`  ->  `payment_term_id`

### `hr.bank_accounts.id` - owner HR, 1 referring column

- `payroll.payroll_payment_items`  ->  `bank_account_id`

### `payroll.salary_components.id` - owner Payroll, 1 referring column

- `hr.employee_salary_components`  ->  `salary_component_id`

### `projects.project_handover.id` - owner Projects, 1 referring column

- `aftersales.warranty_certificates`  ->  `bast_id`

## Contract obligations per target

Each target below names the assert/resolve method the referring module must
call before writing a row that carries the reference.

| Target | Contract method | Extra rule |
|---|---|---|
| `auth.organizations.id` | `resolveOrganization(id)` | The org must exist and the caller must be a member of it. |
| `auth.users.id` | `resolveUser(id)` | The user must be a member of the same organization. |
| `auth.portal_identities.id` | `resolvePortalIdentity(id, orgId)` | Portal identity must be active and of the matching portal type. |
| `catalog.items.id` | `resolveItem(id, orgId)` | Item must not be soft deleted; stock tracked items must have `is_stock_tracked`. |
| `catalog.units.id` | `resolveUnit(id, orgId)` | Unit must be active; the conversion to the base unit must exist. |
| `catalog.price_lists.id` | `resolvePriceList(id, orgId)` | Price list must be active and its currency must match the document currency. |
| `catalog.item_categories.id` | `resolveCategory(id, orgId)` | Category must be active. |
| `crm.customers.id` | `assertCustomerOwnedByOrganization(id, orgId)` | Customer must not be blocked. |
| `crm.customer_contacts.id` | `resolveCustomerContact(id, customerId, orgId)` | Contact must belong to the same customer. |
| `crm.customer_addresses.id` | `resolveCustomerAddress(id, customerId, orgId)` | Address must belong to the same customer. |
| `crm.customer_groups.id` | `resolveCustomerGroup(id, orgId)` | Group must be active. |
| `document.documents.id` | `resolveDocument(id, orgId)` | Document must be issued, not draft and not void. |
| `hr.employees.id` | `resolveEmployee(id, orgId)` | Employee must not be terminated. |
| `hr.bank_accounts.id` | `resolveEmployeeBankAccount(id, employeeId, orgId)` | Bank account must be verified and primary for that employee. |
| `payroll.salary_components.id` | `resolveSalaryComponent(id, orgId)` | Component must be active. |
| `warehouse.warehouses.id` | `resolveWarehouse(id, orgId)` | Warehouse must be active. |
| `projects.projects.id` | `resolveProject(id, orgId)` | Project must not be cancelled. |
| `procurement.suppliers.id` | `resolveSupplier(id, orgId)` | Supplier must not be blocked. |
| `procurement.purchase_orders.id` | `resolvePurchaseOrder(id, orgId)` | Order must not be cancelled. |
| `location.*.id` | `resolveLocation(villageId)` | Must resolve to a full province/regency/district/village path. |
| `organization.branches.id` | `resolveBranch(id, orgId)` | Branch must be active. |
| `organization.departments.id` | `resolveDepartment(id, orgId)` | Department must be active. |
| `organization.positions.id` | `resolvePosition(id, orgId)` | Position must be active. |
| `organization.cost_centers.id` | `resolveCostCenter(id, orgId)` | Cost centre must be active. |
| `sales.invoices.id` | `resolveInvoice(id, orgId)` | Invoice must not be void. |
| `finance.payments.id` | `resolvePayment(id, orgId)` | Payment must be executed. |
| `finance.cash_bank_accounts.id` | `resolveCashBankAccount(id, orgId)` | Account must be active. |
| `finance.cash_bank_transactions.id` | `resolveCashBankTransaction(id, orgId)` | Transaction must be posted. |
| `accounting.chart_of_accounts.id` | `resolveAccount(id, orgId)` | Account must be postable and active. |
| `accounting.journal_entries.id` | `resolveJournalEntry(id, orgId)` | Entry must be posted. |
| `assets.assets.id` | `resolveAsset(id, orgId)` | Asset must not be disposed. |
| `sales.sales_orders.id` | `resolveOrder(id, orgId)` | Order must not be cancelled. |
| `aftersales.service_tickets.id` | `resolveServiceTicket(id, orgId)` | Ticket must be open or in progress to accept an escalation. |

## Validation rules per reference class

### Tenant scope (`organization_id`)

- Every tenant scoped table carries `organization_id`, nullable per
  ADR-0014 (ERP-0037 performs the flip; the shipped schema is still
  `NOT NULL`).
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
- The actor must not be the requester of the same record when the policy
  forbids self approval (`approval.approval_policy_versions.no_self_approval`,
  default `true`).

### Master data scope (items, units, customers, suppliers, employees)

- The target must be active (`is_active = true` where the column exists).
- The target must not be soft deleted (`deleted_at IS NULL`).
- The target must belong to the same organization.

### Document scope (`document_id`, `receipt_document_id`)

- The document must exist in the same organization.
- A receipt document used as payment evidence must be `issued`, never
  `draft` and never `void`.

### Money scope (`finance.payments.id`, `finance.cash_bank_transactions.id`)

- A payment reference is only valid on an `executed` payment.
- A cash bank transaction reference is only valid on a `posted` transaction.

### Ticket scope (`ticket.tickets.*`)

- A portal customer may list and read only tickets whose `customer_id`
  matches its linked CRM customer and whose `organization_id` matches the
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