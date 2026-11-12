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
| [authentication + authorization](authentication.md) | `src/providers/better-auth/*`, (planned) authorization core | A | partially implemented (auth config real; runtime unverified; authorization core absent) |
| [infrastructure](infrastructure.md) | `src/providers/{better-auth,keyv,logger}/*`, `drizzle/{container,db}.ts` | A | mostly implemented, bootstrap unverified |

## Existing domain modules (Elysia — `apps/backend-elysia/src/app`)

| Doc | Code path | Status | Related commercial tasks |
|---|---|---|---|
| [user](user.md) | `src/app/user` | partially implemented | T02 (roles/audit), T03 |
| [organization](organization.md) | `src/app/organization` | scaffold | T02, T15 |
| company (no doc yet) | `src/app/company` | implemented 2026-11-13 (ERP-0042) - company profile, contacts, bank accounts, company-wide settings | ERP-0042 |
| code_number (no doc yet) | `src/app/code-number` | implemented 2026-11-13 (ERP-0042) - the one numbering authority (`code_number.series`) | ERP-0009, ERP-0042 |
| document (no doc yet) | `src/app/document` | implemented 2026-11-13 (ERP-0042) - issued document registry, files, signatures, shares, tags; PDF rendering out of scope | ERP-0042 |
| [location](location.md) | `src/app/location` | scaffold | T07 |

## Assessed / planned owners (no module directory yet)

| Doc | Assessment | Related commercial tasks |
|---|---|---|
| [finance](finance.md) | COA/journals/ledger/posting engine — owner to be created | T04, T06, T11 |
| [tax](tax.md) | tax configuration/workpapers — owner to be created | T12 |
| [asset-project](asset-project.md) | assets/equipment + projects — owner to be created | T07 (assets), T08 (projects) |
| [licensing-subscription](licensing-subscription.md) | `apps/backend/src/app/licensing` (register + license API) | T09, T23 implemented; T24 blocked |
| [investor](investor.md) | `erp.investors` table exists; module absent | T13, T29–T30 |

## Cross-module rules (apply everywhere)

- Repositories use the Drizzle client from `drizzle/container.ts`; routes never
  touch Drizzle.
- Services/repositories use tsyringe constructor injection
  (`@injectable()` + `@inject(TOKEN)`); the provider's container module
  registers non-class dependencies.
- Cross-module access only via exported service/contract APIs.
- Soft deletes and unix-ms timestamps everywhere; money is integer IDR minor
  units (ADR-0002). See `../data-model.md`.
- Routes, envelopes, and error contracts per `../api-conventions.md`;
  permissions per `../security-and-access.md`.
- One business entity, one warehouse (commercially pinned in v5.1; see
  ADR-0001). No proliferation of modules without an owner here.
