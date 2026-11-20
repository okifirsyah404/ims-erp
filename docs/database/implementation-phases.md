# Implementation Phases (history of ADR-0024, P0-P8)

Companion to `docs.dbml` (canonical). This file used to be a forward-looking
plan (steps S1-S8 building a 27-schema, 270-table target on top of a 3-schema
database). ADR-0024 replaced that plan: the database was **normalized in one
refactor and re-baselined**, and the target is now **18 schemas / 188 tables**.
This page records what each phase of that refactor did, in what order, and
what proves it done. The design record is
`docs/architecture/decisions/ADR-0024-database-normalization-baseline-v2.md`;
the working plan (decisions Q1-Q39, per-module files) is
`docs/plan/database-refactor/`; the dated evidence is `docs/plan/progress.md`.

Status words follow `AGENTS.md`: nothing below is `accepted`. ERP-0070..0091
are `in-progress` (code done, verified by the commands listed, no reviewer
acceptance and no end-to-end UI run yet).

## The starting point

Before ADR-0024 the repository carried a mixed set of modules, each with its
own schema: `auth`, `location`, `company`, `code_number`, `organization`,
`crm`, `catalog`, `sales`, `procurement`, `inventory` (+ `warehouse`),
`projects`, `hr`, `payroll`, `finance`, `accounting`, `assets`, `aftersales`,
`document`, `approval`, `budgeting`, `investor`, `commerce`, `automation`,
`licensing`, `ticket`, `audit`, `notification`, `payment`. The previous plan
counted 27 schemas / 270 tables, but a number of them existed only in
`docs.dbml`. Cross-module boundary violations (repositories reading another
module's tables) were part of the problem.

## The target

| # | Schema | Tables | Absorbs / replaces |
|---|---|---|---|
| 1 | `auth` | 11 | Better Auth core + `user_invitations`, `organization_settings`; portal identity folded into `customer` |
| 2 | `location` | 4 | unchanged |
| 3 | `company` | 4 | `bank_accounts` moved to `finance.cash_bank_accounts` |
| 4 | `customer` | 6 | `crm`; `customer_contacts` merged into `customers`; portal identity |
| 5 | `supplier` | 6 | split out of `procurement` |
| 6 | `inventory` | 28 | `catalog`, `assets`, `warehouse` (the two-schema exception is gone) |
| 7 | `sale` | 18 | `sales` |
| 8 | `procurement` | 9 | without the supplier master |
| 9 | `finance` | 27 | `accounting`, asset depreciation |
| 10 | `tax` | 5 | split out of `accounting` |
| 11 | `payment` | 5 | one ledger (`channel` manual / gateway), polymorphic allocations, sealed gateway secrets |
| 12 | `project` | 28 | `projects`, leads (from `crm`), warranties (from `aftersales`), `licensing` |
| 13 | `ticket` | 6 | service tickets of `aftersales` |
| 14 | `human_resource` | 12 | `hr` (salary stays here) |
| 15 | `document` | 12 | gains `settings` and `code_numberings` |
| 16 | `notification` | 2 | `push_notifications`, `push_notification_templates` |
| 17 | `audit` | 1 | unchanged |
| 18 | `automation` | 4 | outbox, FAQ, WhatsApp; integration/workflow tables dropped |
| - | `webhook` | 0 | module without a schema: the inbound provider HTTP edge |

Removed with no replacement: `code_number` (every schema owns a
`code_numberings` table and a `<Module>NumberingService`), the `organization`
*schema* (branches, departments, positions, cost centres, fiscal tables; the
`organization` backend module remains and works over `auth.organizations`),
`payroll`, `approval`, `budgeting`, `investor`, `commerce`. Per-module
profiles: `module-ownership.md`.

## Ground rules that applied to every phase

1. **Backend first, frontend after.** Each phase leaves `tsc` and the unit
   tests green for the backend; the workspace typecheck was allowed to be red
   only because of the seeders until P8.
2. **`docs.dbml` first.** Edit it, then `bun docs/database/gen-logical-references.ts`,
   then `bun docs/database/validate-dbml.ts` (must print `OK`), then Drizzle.
3. **No cross-schema foreign keys.** A column pointing at another module's
   table is a plain nullable id column with the standard logical-reference
   note; the owning module exposes a `resolve*` / `assert*` contract
   (ADR-0014). Intra-module foreign keys stay real.
4. **Controllers do HTTP only; services own use cases; repositories own
   Drizzle queries.** No module imports another module's repository.
5. **Every code change writes `progress.md`, `backlog.md` and
   `plans/features.md`** in the same change.
6. **Honesty.** Statuses are `in-progress` until a reviewer accepts them.

## Phases

| Phase | Scope | Backlog | Commit | Evidence |
|---|---|---|---|---|
| P0 | ADR-0024, shared numbering helper, `docs.dbml` rewrite, Drizzle schema files, plan | ERP-0070 | `2df2f001`, `2c485faf` (plan), then in P1 | `validate-dbml.ts` OK |
| P1-P3 | location, auth (user + organization), company; customer, supplier; inventory (absorbs assets and catalog, `ExportedInventoryService`) | ERP-0071..0076 | `00899c76` | backend `tsc` clean per folder, unit tests green |
| P4 | procurement (supplier removed, `/procurement/*`) and sale (`/sales/*`, `ExportedOrderService`); header+items repositories kept in both | ERP-0077, ERP-0078 | `1f179be2` | `tsc`, unit tests |
| P5 | finance absorbs accounting (+ `DepreciationService`, `/finance/depreciations`), tax split out at `/taxes`, payment reworked (one ledger, sealed gateway secrets, `PAYMENT_SECRET_KEY`), `code-number` deleted | ERP-0079..0081 | `44ac6046` | `tsc`, finance/tax/authorization tests |
| P6 | project absorbs licensing and warranty, ticket replaces aftersales, `human-resource` replaces hr | ERP-0082..0084 | `3f85959b` | `tsc`, unit tests |
| P7 | document numbering and `/documents/public/v1/shares`, `push_notifications`, new schema-less `webhook` module, outbox aggregate `ticket` | ERP-0085..0087, ERP-0089 | `540897dc` | `tsc` 0 errors in `src/` and `test/`, `bun test test/unit` 790 pass, `bun test test/finance test/tax test/authorization test/notification` 441 pass, `validate-dbml.ts` OK |
| P8 | cutover: seeders rewritten, v1 migrations archived to `database/migrations-archive/v1`, one baseline migration, module profiles rewritten | ERP-0088 | `a2616a9a`, `884c7e35` | see below |

### P8 in detail (the verified baseline)

- `bunx --bun drizzle-kit generate` produced one baseline
  (`database/migrations/20261120061847_last_daredevil`): 18 `CREATE SCHEMA`,
  164 `CREATE TABLE`, 151 unique indexes, **0 cross-schema `REFERENCES`**
  (checked with a regex over the SQL).
- A second `generate` reported "No schema changes".
- On a disposable database: `drizzle:migrate` applied cleanly, `drizzle:seed`
  ran twice and the second run inserted 0 rows (idempotent). A later smoke run
  (2026-11-20) repeated migrate + seed and booted the backend (see below).
- Root `bun run lint`, `bun run test`, `bun run build`, `bun run typecheck`
  green; locales 98 tests after removing the dead keys of deleted modules.

## Decisions worth knowing (full list: `docs/plan/database-refactor/00-overview.md`)

- Q2: squashed per-schema baseline instead of an append chain (ADR-0019 naming).
- Q10: addresses store only `village_id`; the rest of the path is derived
  through `ExportedLocationService.resolveVillagePath`.
- Q12, Q13: leads and warranties move into `project`. Q16: contacts merge into
  `customer.customers`. Q17: supplier split. Q18: payment ledger. Q19:
  `company.bank_accounts` becomes `finance.cash_bank_accounts`.
- Q14, Q15, Q24-Q27: inventory absorbs assets and catalog (one `items`
  table for physical units, `products` for SKUs, one `movements` ledger).
- Q22: integration, workflow and scheduled-job tables of `automation` dropped.
- Q32: per-module numbering and `code_numberings`; `document.issue` takes the
  owning module's `code`.
- Q34 (revised 2026-11-20): **no URL aliases**. Nothing is deployed, so the
  old URLs were removed at cut-over instead of kept.
- Q38: `webhook` is a module without a schema and delegates to
  `ExportedPaymentWebhookService` and `ExportedWhatsappWebhookService`.
- Q39: salary stays in `human_resource`.

## After the schema phases

| Slice | What | Backlog | Commits |
|---|---|---|---|
| Frontend 1-5 | web-admin wrappers and screens moved to the new endpoints (inventory/assets/borrowing; sale/customer/procurement/supplier; finance/tax/payment gateway page/company; project/lead/license/ticket/handover; human-resource/documents/automation) | ERP-0090 | `856b0b7a`, `96b0cb63`, `fd349100`, `f8370a5b`, `8817d268` |
| Alias removal | the Q34 aliases removed from the backend; docs updated | ERP-0088 | `3b9edfda` |
| Slice 6 | web-landing and web-customer-portal connected to the ERP public / portal API | ERP-0091 | `23e541cb`, `8620ee66`, `114dbd2e` |
| Dependency pin | `@lucide/astro` 1.61.0, `@vite-pwa/astro` 1.2.0, `vite-plugin-pwa` 1.3.0 (builds were broken on a fresh frozen install) | - | `01473a2a` |
| Live API smoke | disposable DB: baseline + seed, backend boot (every controller resolved through DI), 69 GET endpoints as owner (65 x 200, 4 x 400 needing query params, 0 x 404/5xx), supplier/employee/gateway writes, supplier bank gate, removed aliases answer 404 | - | `5929efd9` |

## Still open (not done by ADR-0024)

- No UI was clicked through; web-admin wrappers are hand-written untyped
  `fetch` calls checked only by reading controllers.
- `ExportedFinanceService` and `ExportedJournalService` (tax recap) are not
  built; ticket templates and sub-tickets (Q29) are target-only in the dbml;
  `employee_addresses` and the supplier address endpoints have no Drizzle
  table or controller yet.
- Webhook envelope: for `rejected` and `unknown` outcomes the body still says
  `status: 200` while the HTTP status is 401/404.
- Decisions pending: tickets for company customers, `payment_gateway:read`
  for finance, the Docker default http base URL of the portal, and the
  proper fix of the two Astro dependency breaks (then lift the pins).
- ERP-0070..0091 stay `in-progress` until a reviewer accepts them.

## Commands (all run from `apps/backend` unless stated)

| Command | Status |
|---|---|
| `bunx --bun drizzle-kit generate` | verified 2026-11-19: one baseline; a second run reports no changes |
| `bun run drizzle:migrate` (disposable DB only) | verified 2026-11-19 and 2026-11-20 |
| `bun run drizzle:seed` | verified twice on 2026-11-19: second run inserted 0 rows |
| `bun docs/database/gen-logical-references.ts` (repo root) | verified, regenerates `logical-references.md` |
| `bun docs/database/validate-dbml.ts` (repo root) | verified, prints `OK` (188 tables, 162 intra-module refs, 169 logical reference columns) |

Never migrate a production database or run destructive operations against an
unknown `POSTGRES_URL`.
