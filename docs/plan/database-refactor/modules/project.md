# project - ERP-0082

Schema `project` (was `projects`) · folder `src/app/project` (was `projects`;
absorbs `licensing`, leads from `crm`, warranty from `aftersales`) · URL
`/projects` · phase P6

## Current

- `projects`: projects, project_tasks, project_evidence, project_costs,
  project_handover; repositories handover, project; controller `/projects`.
- `licensing`: licensable_applications, license_contracts, license_keys,
  application_api_keys, license_activations, license_events; repositories
  licensing, license-api; controllers `/licenses`, `/licensing/v1` (external
  app API).
- `crm`: leads, lead_activities, lead_attachments; controllers `/leads`,
  `/public/v1` inquiries (website RFQ/contact/demo).
- `aftersales.warranty_certificates`; controller `/warranty-certificates`.
- Consumers: web-admin `project-api.ts`, `handover-api.ts`, `license-api.ts`
  (10 importers), `lead-api.ts`, warranty calls in `service-ticket-api.ts`;
  web-landing RFQ/contact forms; n8n follow-up workflow (ERP-0066).

## Target tables

| Table | From / notes |
|---|---|
| projects | + `company_id`, `lead_id`, `type_id` (target, with `types`), `address_id` (-> project.addresses) |
| tasks, evidence, costs, handover | `project_*` renamed; same-module FKs become real FKs |
| addresses | new: project site address (Q10) |
| leads | `crm.leads`; + `company_id`; `customer_id` -> customer.customers (nullable, Q23) |
| lead_activities, lead_attachments | `crm.*` |
| warranties | `aftersales.warranty_certificates`; `bast_id` -> handover FK (now intra-schema); `customer_id`/`company_id` |
| license_applications, license_contracts, license_keys, license_activations, license_events, license_api_keys | `licensing.*`; `license_api_keys.api_key_id` -> auth.apikeys (logical); `license_contracts.sales_order_id` -> `order_id` (sale.orders) |
| types, phases, task_dependencies, milestones, daily_reports, site_assignments, kpi_definitions, kpi_evaluations, changes, work_plans | target only |
| settings, code_numberings | new (project, BAST, lead/web reference, warranty, license contract codes) |

## Steps

1. **dbml** - rewrite section; remove `licensing`, crm lead tables,
   aftersales warranty.
2. **Drizzle** - `project.schema.ts` (`pgSchema('project')`); delete
   `projects.schema.ts`, `licensing.schema.ts`, lead part of `crm.schema.ts`.
3. **Repositories** - project, task, evidence, cost, handover, address, lead,
   lead-activity, lead-attachment, warranty, license-application,
   license-contract, license-key, license-activation, license-event,
   license-api-key, setting, code-numbering.
4. **Services** - ProjectService (create from order via
   `ExportedOrderService`), HandoverService, WarrantyService, LeadService
   (won -> `ExportedCustomerService.createFromLead`, Q23), WebsiteInquiryService
   (outbox events unchanged), LicensingService, LicenseApiService (machine
   API, uses `ExportedUserService` for API-key checks).
   Publish `ExportedLeadService` (sale) and `ExportedProjectService` /
   `ExportedWarrantyService` (ticket, customer portal) - repository-only.
5. **Controllers** - `/projects`, `/projects/handovers`, `/projects/leads`,
   `/projects/warranties`, `/projects/licenses/*`,
   `/projects/public/v1/inquiries` (+ alias `/public/v1` inquiry routes),
   `/projects/api/v1/licenses/*` (+ alias `/licensing/v1/*`, Q34).
6. **Consumers** - web-admin `project-api.ts`, `handover-api.ts`,
   `license-api.ts`, `lead-api.ts`, warranty calls; lead and license routes
   move under the Projects menu; web-landing form endpoints; n8n workflow
   payload links (outbox topics unchanged).

## Exit

Lead -> customer conversion, project from order, BAST -> warranty, license
validate/activate (via new URL and alias) tests green.
