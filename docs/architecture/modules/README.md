# Technical Modules — Index

One file per technical module of the backend (plus planned owners). Each file
states purpose/boundary, current verified state, data ownership, planned
behavior where the commercial scope demands it, dependency rules, and tests.
Sources: repository audit (`../project-audit.md`, evidence-based) and the
commercial baseline — Entragate ERP Plan v5.1 (2026-10-21, outside the repo;
Excel Tracker/UAT details live there too).

Status vocabulary: `planned / in-progress / implemented / verified / accepted /
blocked`.

## Module index (ADR-0024, 2026-11-20)

The ERP has 18 Postgres schemas / 188 tables plus the schema-less `webhook`
module. Ownership, tables and contracts: `docs/database/module-ownership.md`.
Deprecated pages are kept for history (owner decision) and start with a banner
naming the current owner. The `user` and `organization` backend modules both
sit in the `auth` schema (Better Auth owns those tables).

### Current

| Module | Schema | Page | Status |
|---|---|---|---|
| Identity (users, organizations) | `auth` | [user](user.md), [authentication](authentication.md) | current (user: banner with 2026-11-20 corrections); organization HTTP: see deprecated `organization` |
| Location | `location` | - | current, no page (ownership profile only) |
| Company | `company` | [company](company.md) | current (fixed in place: bank accounts moved to `finance`) |
| Customer | `customer` | [customer-portal](customer-portal.md) (portal API) | current for the portal API (fixed in place: `/customers/portal/v1`); `customer.md` deprecated |
| Supplier | `supplier` | [supplier](supplier.md) | current (rewritten 2026-11-20) |
| Inventory | `inventory` | [inventory](inventory.md) | current (banner: absorbs assets, catalog, warehouse) |
| Sale | `sale` | [sale](sale.md) | current (new) |
| Procurement | `procurement` | - | current, no page; `purchasing.md` deprecated |
| Finance | `finance` | [finance](finance.md) | current (banner: absorbs accounting) |
| Tax | `tax` | [tax](tax.md) | current (names fixed; route table partly pre-refactor, see banner) |
| Payment | `payment` | - | current, no page; `payment.md` deprecated |
| Project | `project` | [project](project.md), [licensing-integration](licensing-integration.md) | current (new); the license how-to is still accurate |
| Ticket | `ticket` | [ticket](ticket.md) | current (new) |
| Human Resource | `human_resource` | [human-resource](human-resource.md) | current (new) |
| Document | `document` | [document](document.md) | current |
| Notification | `notification` | [notification](notification.md) | current (table names fixed) |
| Audit | `audit` | - | current, no page |
| Automation | `automation` | [automation](automation.md) | current (catalog reference fixed) |
| Webhook | none | [webhook](webhook.md) | current (new) |

### Platform and cross-cutting

| Page | Status |
|---|---|
| [authentication](authentication.md) | current in substance; carries the NestJS-era banner of 2026-10-28 (not re-audited) |
| [infrastructure](infrastructure.md) | current in substance; carries the NestJS-era banner of 2026-10-28 (not re-audited) |
| [website-and-portal](website-and-portal.md) | current (apps and API clients) |

### Deprecated (kept for history)

| Page | Pre-refactor module | Replacement |
|---|---|---|
| [asset-project](asset-project.md) | assets/projects | deprecated -> [inventory](inventory.md), [project](project.md) |
| [code-number](code-number.md) | code-number | deprecated -> per-module `code_numberings` in every schema |
| [customer](customer.md) | crm | deprecated -> `customer` schema (`customer-portal.md`, ownership doc) |
| [employee](employee.md) | hr | deprecated -> [human-resource](human-resource.md) |
| [expense](expense.md) | expense | deprecated -> [finance](finance.md) (`expense_claims`, advances, settlements) |
| [investor](investor.md) | investor | deprecated -> none (never built) |
| [licensing-subscription](licensing-subscription.md) | licensing | deprecated -> [project](project.md) |
| [organization](organization.md) | organization | deprecated -> `auth` schema (HTTP stays in `src/app/organization`) |
| [payment](payment.md) | payment (NestJS audit) | deprecated -> `payment` schema (ownership doc) |
| [product](product.md) | catalog | deprecated -> [inventory](inventory.md) |
| [purchasing](purchasing.md) | purchasing | deprecated -> `procurement`, [supplier](supplier.md), finance bills |
| [reporting](reporting.md) | reporting | deprecated -> `finance.report_archives`, dashboard |
| [sales](sales.md) | sales | deprecated -> [sale](sale.md) |
| [warehouse](warehouse.md) | warehouse | deprecated -> [inventory](inventory.md) |
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
