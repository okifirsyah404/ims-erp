# Project Module

> Created 2026-11-20 (ADR-0024). Absorbs the pre-refactor `projects`, the
> `licensing` module, leads (from `crm`) and warranties (from `aftersales`).
> See `licensing-integration.md` for the how-to of the license API.

Code: `apps/backend/src/app/project`. Schema: `project`. Profile:
`docs/database/module-ownership.md` (#12). Tables: `docs/database/docs.dbml`.

## Purpose and boundary

Everything about delivering to a customer after the deal: leads, projects and
their execution records, BAST (handover), warranty certificates, and the
license/subscription register for the company's own applications. Quotes and
invoices stay in `sale`; tickets in `ticket`.

## Owned tables (28)

- Projects: `projects`, `types`, `addresses`, `phases`, `tasks`,
  `task_dependencies`, `milestones`, `costs`, `evidence`, `handover`,
  `daily_reports`, `site_assignments`, `kpi_definitions`, `kpi_evaluations`,
  `changes`, `work_plans`.
- Leads: `leads`, `lead_activities`, `lead_attachments`.
- `warranties`.
- Licensing: `license_applications`, `license_contracts`, `license_keys`,
  `license_activations`, `license_events`, `license_api_keys`.
- `settings`, `code_numberings` (`ProjectNumberingService`).

## HTTP

- Staff (`erp` guard): `/projects` (CRUD, `close`, `cancel`, tasks, evidence,
  costs, `/basts`), `/projects/leads` (status, assign, activities,
  `convert`), `/projects/warranties`, `/projects/licenses` (applications,
  API keys, contracts, keys, activations, events).
- Machine API: `POST /projects/api/v1/licenses/validate|activate|deactivate`,
  authenticated by an application API key; no aliases.
- Website API (no session): `POST /projects/public/v1/rfq|contact|demo`.

## Contract

Consumed through `ProjectLookupService` and `ProjectPortalService`
(portal view without costs). It consumes `ExportedCustomerService` and
`ExportedCompanyService`; there is no `Exported*` facade of its own yet.

## Permissions

Resources `project` (`read_cost` hides costs), `lead`, `license`
(`read_key`, `manage_api`), plus the handover and warranty actions under
`project`.

## Key rules

- Leads convert into customers/projects through the owning module's
  contracts (ADR-0014); a lead is never a customer.
- Costs are never visible to the portal or to roles without `read_cost`.
- License secrets (keys, machine API keys) are shown once or masked;
  activation consumes a seat, `release` frees it.
- Money is integer IDR minor units; soft delete only.
