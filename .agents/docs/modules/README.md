# Technical Modules — Index

One file per technical module of the backend (plus planned owners). Each file
states purpose/boundary, current verified state, data ownership, planned
behavior where the commercial scope demands it, dependency rules, and tests.
Sources: repository audit (`../project-audit.md`, evidence-based) and the
commercial baseline — Entragate ERP Plan v5.1 (2026-10-21, outside the repo;
Excel Tracker/UAT details live there too).

Status vocabulary: `planned / in-progress / implemented / verified / accepted /
blocked`.

## Core / platform

| Doc | Code path | Owner | Status |
|---|---|---|---|
| [authentication + authorization](authentication.md) | `src/providers/better-auth/*`, `src/core/authorization/*` (planned), `modules/auth` (planned) | A | partially implemented (auth config real; module + runtime unverified; authorization core absent) |
| [infrastructure](infrastructure.md) | `src/config/*`, `src/bootstrap.module.ts`, `src/providers/{drizzle,keyv}/*` | A | mostly implemented, bootstrap verified by compilation only |

## Existing domain modules (NestJS)

| Doc | Code path | Status | Related commercial tasks |
|---|---|---|---|
| [user](user.md) | `modules/user` | partially implemented (reference repository pattern) | T02 (roles/audit), T03 |
| [organization](organization.md) | `modules/organization` | scaffold only | T02, T15 |
| [customer](customer.md) | `modules/customer` | partially implemented (schema real; code scaffold) | T03, T05; S1 slice ERP-0004..0006 |
| [employee](employee.md) | `modules/employee` | scaffold only | T10; T19–T20 (payroll) |
| [expense](expense.md) | `modules/expense` | scaffold only | T07 adjacent, T11 |
| [inventory](inventory.md) | `modules/inventory` | scaffold only | T07 |
| [notification](notification.md) | `modules/notification` | scaffold only | T15; T27–T28 (WhatsApp AI) |
| [payment](payment.md) | `modules/payment` | scaffold only | T06; T21–T22 (gateway) |
| [product](product.md) | `modules/product` | scaffold only | T03 (catalog) |
| [purchasing](purchasing.md) | `modules/purchasing` | scaffold only | T07 |
| [reporting](reporting.md) | `modules/reporting` | scaffold only | T11 (reports), T14 (dashboard) |
| [sales](sales.md) | `modules/sales` | scaffold only | T05 (CRM/SPH/invoice) |
| [supplier](supplier.md) | `modules/supplier` | scaffold only | T07 (procurement) |
| [warehouse](warehouse.md) | `modules/warehouse` | scaffold only | T07 (one warehouse) |

## Assessed / planned owners (no module directory yet)

| Doc | Assessment | Related commercial tasks |
|---|---|---|
| [finance](finance.md) | COA/journals/ledger/posting engine — owner to be created | T04, T06, T11 |
| [tax](tax.md) | tax configuration/workpapers — owner to be created | T12 |
| [asset-project](asset-project.md) | assets/equipment + projects — owner to be created | T07 (assets), T08 (projects) |
| [licensing-subscription](licensing-subscription.md) | licensing API + subscription owner to be created | T09, T23–T24 |
| [investor](investor.md) | `erp.investors` table exists; module absent | T13, T29–T30 |

## Cross-module rules (apply everywhere)

- Repositories inject via `@InjectDrizzle()`; never import `drizzleDB`
  (ADR-0005). Controllers never touch Drizzle.
- Cross-module access only via exported service/contract APIs; no `forwardRef`.
- Soft deletes and unix-ms timestamps everywhere; money is integer IDR minor
  units (ADR-0002). See `../data-model.md`.
- Routes, envelopes, and error contracts per `../api-conventions.md`;
  permissions per `../security-and-access.md`.
- One business entity, one warehouse (commercially pinned in v5.1; see
  ADR-0001). No proliferation of modules without an owner here.
