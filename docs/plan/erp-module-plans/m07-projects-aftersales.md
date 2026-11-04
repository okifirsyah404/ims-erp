# M07 — Projects and After-Sales

## Purpose

Runs installation projects from a won deal to BAST (signed handover), and
handles after-sales tickets and warranty. Stage 2 lets customers see their
own project status, BAST and tickets in the customer portal.

## Stage 1 scope (baseline)

- Project PIC and target.
- Tasks with status.
- Direct costs.
- Testing, training and BAST evidence.
- Tickets and warranty, with **manual closure confirmation**.

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Project | customer, source SPH/invoice, name, site address, PIC, start date, target date, contract value | `planned → in_progress → testing → handed_over (BAST) → closed` / `cancelled` |
| Task | project, title, assignee, due date | `todo → in_progress → done` |
| Direct cost | project, date, category (material/labour/transport/other), amount, receipt evidence | — |
| Evidence | project, type (`testing`, `training`, `bast`), file, date, signed by | — |
| Ticket | customer, project or SN/item, issue, reported via (internal/portal/WA), priority | `open → in_progress → resolved → closed` |
| Warranty check | ticket → item SN / project BAST date + warranty period | result: `in_warranty` / `out_of_warranty` |

- BAST: the signed document is uploaded as evidence. Uploading the BAST moves
  the project to `handed_over` and starts the warranty period.
- Direct costs are recorded against the project for margin visibility. Stock
  issued from M05 is referenced, not costed automatically.
- Closure (S09 "confirmation → close"): `resolved` needs a customer
  confirmation (recorded by staff in Stage 1) before `closed`.
- Out-of-warranty work can produce an SPH/invoice in M02.

## Stage 2 scope (baseline) — part of add-on: Customer portal

- The customer portal shows project and BAST status.
- The customer portal shows the customer's **own** tickets.

_Interpretation, needs owner confirmation:_

- Customers can open a ticket from the portal and add messages/attachments.
- Customers can confirm resolution in the portal. This replaces the
  staff-recorded confirmation.
- Portal project view: status, target date, milestones/tasks summary and
  BAST download. No internal costs or internal notes.

## Explicit limits (out of scope)

- No detailed technician scheduling (calendar, dispatch, route planning).
- No automatic SLA (timers, breach alerts, escalation).
- No automatic material allocation to projects.
- No Gantt charts or task dependencies.

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T08 | Projects, BAST, and basic tickets | B | S1 8–9 | 337,500 |
| T26 | Customer project status and tickets | B | S2 16–18 | 400,000 |

T26 depends on T25 (customer accounts, in M12).

## SOPs

- **S08 Projects:** plan/PIC, tasks/evidence, testing/training, BAST.
- **S09 After-sales:** internal or portal ticket, check warranty, task/cost,
  confirmation, close.

## Controls

- Customers see only projects/tickets where they are the customer. This is
  checked on the server for list, detail and file download.
- Internal costs and internal comments are never exposed in portal
  responses. Use separate portal DTOs.
- BAST and evidence files are protected downloads (signed or short-lived
  URLs, ownership-checked).
- Direct costs are integer IDR minor units.

## Acceptance

- UAT: project/ticket scenarios in U01–U20 and portal scenarios in U21–U32,
  per Excel. Scenario text is not in the repo.
- _Interpretation:_ the tests cover a project run to BAST that starts the
  warranty, an in-warranty ticket and an out-of-warranty ticket, and
  customer A trying to open customer B's ticket (denied).

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Project and ticket status guards have tests (for example, no `closed`
  without confirmation).
- Portal endpoints have cross-account denial tests for projects, tickets and
  BAST download.
- A project margin view (contract value − direct costs) matches the entered
  data.

## Dependencies

- Needs: M02 (won deal, customer), M05 (SN, stock issued), M06 (tools), M08
  (employees as PIC/assignees), M12 (customer accounts, Stage 2).
- Provides: project status to M01, tickets to the customer portal, warranty
  events to M04 notifications (Stage 2).

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Projects, tasks | `projects` (13 tables) | none |
| BAST | `projects.project_handover` | none |
| Direct costs | (no clear table; may be `finance.expense_*`) | none |
| Tickets | `ticket` (5 tables) **and** `aftersales.service_tickets` (+14) | none |
| Warranty | `aftersales.warranty_policies`, `warranty_claims`; SN status `applied_warranty` in inventory | SN status shipped only |

- Status: **planned**.
- `beyond-baseline`:
  - `projects.project_task_dependencies`, `project_kpi_definitions` /
    `project_kpi_evaluations`, `project_site_assignments`,
    `project_work_plans`, `project_changes` and `project_daily_reports`.
    Technician scheduling and Gantt-style planning are explicit limits.
  - `aftersales.sla_policies` (automatic SLA is an explicit limit),
    `service_technicians`, `maintenance_schedules`/`plans`/`visits`/
    `visit_tasks`, `satisfaction_surveys`, `spare_parts`,
    `service_parts_usage` and `service_contracts`.
  - There are two ticket models (`ticket` vs `aftersales.service_tickets`).
    The plan needs one basic ticket. Which one is kept needs a decision.
  - Project direct costs have no obvious home table. This is a **gap**, not
    an extra.
