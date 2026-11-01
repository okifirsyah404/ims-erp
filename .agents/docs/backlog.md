# Backlog

Stable engineering task IDs. Scope source is marked per item; the original
32-task commercial list is **not reproducible in-repo and stays `pending`**.
If it is supplied later, remap these IDs to it rather than inventing new
commercial claims.

Statuses: `planned` → `in-progress` → `implemented` → `verified` → `accepted`
(requires actual reviewer approval; a green test suite alone never qualifies)
or `blocked`.

Owners: A / B (two programmers; no overlapping full-capacity tasks on the same
module).

| ID | Title | Source | Module | Acceptance criteria | Depends on | Owner | Effort (d) | Status |
|---|---|---|---|---|---|---|---|---|
| ERP-0001 | Repo housekeeping | engineering | root | README reflects project; `build:libs` script fixed/removed; starter deletions committed intentionally | — | A | 0.5 | planned |
| ERP-0002 | Authorization core | pre-written specs (`test/unit/core/authorization/*`) | backend core | `roles`/`ownership` specs pass; permission list matches `web-admin/lib/permissions.ts`; empty `role-permission.ts` resolved | — | A | 1.5 | planned |
| ERP-0003 | Auth module + runtime verification | engineering + better-auth docs | backend `auth` | login/logout/session proven at runtime; guard denies unauthenticated | ERP-0002 | A | 2 | planned |
| ERP-0004 | Customer slice backend | §reference slice requirements | backend customer | list/detail/create/update/deactivate endpoints, DTO validation, owner checks, cache eviction; unit + real-PG integration + e2e passing | ERP-0002, ERP-0003 | A | 2 | planned |
| ERP-0005 | Customer slice frontend | §reference slice requirements | web-admin | authenticated customer page in sidebar (Indonesian labels), list/detail/create/update/deactivate, loading/empty/error/unauthorized states, query invalidation; persists across reload | ERP-0004 | B | 1.5 | planned |
| ERP-0006 | Address reference model + lookup API | section 7 master data #2 + ADR-0003 | backend customer/providers | reference tables seeded idempotently from raw JSON; cached paginated lookup; customers reference village-level rows; no address JSON in browser bundle | ERP-0004 | B | 1.5 | planned |
| ERP-0007 | User domain completion | existing repo | backend user | user CRUD/status flows finished; cache + soft-delete invariants tested | ERP-0003 | B | 1 | implemented (2026-10-30; e2e admin-session verification pending; see progress.md) |
| ERP-0008 | Remaining master data | section 7 catalog | backend (various) | company profile, suppliers, product/service catalog unified, categories/units, warehouse, employees, COA, cash/bank, subscription packages, investors master; seeders idempotent | ERP-0004 | A+B | 3 | planned |
| ERP-0009 | Code generation/numbering config | engineering | backend common | document numbering service for invoices etc.; collision-safe | ERP-0008 | A | 1 | planned |
| ERP-0010 | Accounting foundations | section 8 invariants | backend accounting owner | COA + journals + ledger skeleton; balance & idempotency invariants unit-tested | ERP-0008 | A | 3 | planned |
| ERP-0011 | Sales (SPH→invoice→receipts) | commercial scope | backend sales | quote/invoice/DP/partial settlement flows with receivables; tests incl. financial invariants | ERP-0010 | A | 3 | planned |
| ERP-0012 | Purchasing & payables | commercial scope | backend purchasing/supplier | purchase bills, payables, supplier payments; restricted bank-detail access tested | ERP-0010 | B | 2.5 | planned |
| ERP-0013 | Expense flows | commercial scope | backend expense | expense entry + journal posting | ERP-0010 | B | 1.5 | planned |
| ERP-0014 | Inventory movement boundaries | commercial scope | backend inventory | stock movements + valuation boundaries; reconciliation to GL control | ERP-0010 | B | 2 | planned |
| ERP-0015 | Assets & projects/BAST | commercial scope | backend (new owner assessed in phase 5) | asset master incl. depreciation entries; project progress + handover records | ERP-0010 | A | 2 | planned |
| ERP-0016 | Financial reports & tax recap | commercial scope | backend reporting | P&L, balance sheet, cash flow, drill-down, configurable tax recap workpapers | ERP-0011..0013 | A | 2.5 | planned |
| ERP-0017 | Period close & reopening | section 8 invariants | backend accounting | close locks posting; reopen permission + audit trail tested | ERP-0016 | A | 1 | planned |
| ERP-0018 | Payroll automation | commercial scope | backend employee | approved inputs → components/rules → run → approval → payslip → journal | ERP-0010, ERP-0013 | A | 3 | planned |
| ERP-0019 | Subscription & licensing | commercial scope | backend product/payment | packages, contracts, renewal, activation/validation, expiry/suspend, replay-safe | ERP-0011 | B | 2.5 | planned |
| ERP-0020 | Checkout & payment gateway | commercial scope | backend payment | one provider sandbox; webhook authenticity, idempotency, retries, safe state transitions; never trust redirect | ERP-0011 | B | 3 | planned |
| ERP-0021 | WhatsApp AI + orchestration | commercial scope | backend notification/user | one number/provider, approved-knowledge FAQ, lead capture, human handoff; prompt-injection hardening tests; sandbox-only until approved | ERP-0019, ERP-0006 | B | 3 | planned |
| ERP-0022 | Customer portal | commercial scope | web-admin (+profiles backend) | self-scoped orders/invoices/payments/projects/licenses/tickets; cross-customer tests | ERP-0011, ERP-0019 | A | 2 | planned |
| ERP-0023 | Investor portal | commercial scope | web-admin | read-only own capital/distributions/payment history + profit-sharing distribution approval flow backend | ERP-0016 | A | 2 | planned |
| ERP-0024 | UAT, reconciliation, backup | phase 7 | cross | full-cycle UAT scripts; subledger↔GL reconciliation checks; backup/restore drill | most items | A+B | 2 | planned |
| ERP-0025 | Release preparation | phase 7 | cross | runbook verified end-to-end on staging; docs final | ERP-0024 | A+B | 1 | planned |
| ERP-0026 | Organization module + member CRUD + seeders | engineering (ADR-0001, multi-org per ADR-0007) | backend `organization`, web-admin | `/organizations` CRUD supporting multiple internal organizations (app-admin-only creation, creator becomes owner, last-org delete 409), soft delete/restore via `deletedAt`, member list/add/role/remove with last-owner 409; web-admin dedicated route pages + real-data organization switcher (admins see all orgs); Entragate org seeder (dev-only) + 16 internal-role accounts (dev password `<role>123456`), idempotent | ERP-0003, ERP-0007 | A | 2 | implemented (2026-10-31, multi-org 2026-11-02; live smoke verified — see progress.md; browser-side acceptance pending) |

Original commercial mapping (`pending`):

- 12 business module groups: **not available in repo** — engineering groupings
  in `domain-map.md` are the stand-in.
- 13 SOPs: **not available in repo** — do not fabricate; wait for source.
- 32 commercial tasks + pricing: **not available in repo** — no fabricated
  list; per-task prices were never provided by the business here.

Overall effort above (≈50d of pair-days across A+B) intentionally exceeds the
30-day window: it is the dependency-based forecast of remaining work, not a
promise. `plan.md` scores the variance instead of compressing tasks.


