> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# UAT scripts (ERP-0024, phase 7)

User acceptance test scripts for the modules owned by programmer B: M02, M03,
M04, M05, M07, M08. Each script turns the module plan's **Acceptance**
section (`docs/plan/erp-module-plans/`) into numbered steps a business user
can run in the web admin. The original U01–U32 Excel scenarios are not in the
repo; where a plan says "per Excel", the cases below are our interpretation
and the reviewer may replace them.

| File | Module | Module plan |
| --- | --- | --- |
| [m02-crm-sales.md](m02-crm-sales.md) | M02 CRM and Sales | `m02-crm-sales.md` |
| [m03-licensing.md](m03-licensing.md) | M03 Subscription and Licensing | `m03-subscription-licensing.md` |
| [m04-integrations.md](m04-integrations.md) | M04 n8n, WhatsApp, Website | `m04-n8n-whatsapp-website.md` |
| [m05-inventory-purchasing.md](m05-inventory-purchasing.md) | M05 Inventory and Purchasing | `m05-inventory-purchasing.md` |
| [m07-projects-aftersales.md](m07-projects-aftersales.md) | M07 Projects and After-Sales | `m07-projects-aftersales.md` |
| [m08-hr.md](m08-hr.md) | M08 Employees and Attendance | `m08-employees-attendance.md` |

## Status

**Scripts written 2026-11-12, not yet run.** No case below has a result.
A script is `verified` only after a tester runs it and records the results
here; it is `accepted` only with the reviewer's sign-off at the bottom of the
file. Green automated tests are not UAT.

## How to run

1. **Environment:** a staging or disposable database (never production),
   migrated and seeded (`docs/architecture/runbook.md`). M08 needs PR #83 and
   M04 needs PR #84 merged into the build under test.
2. **Accounts:** the seeded role accounts `<role>.seed@entragate.local`
   (dev-only password convention in
   `apps/backend/database/seeders/seed/organization-members.seeder.ts`;
   change them on any shared server). Two people with approval rights are
   needed for every "no self-approval" case.
3. **Setup once:** company profile, document numbering, at least two
   customers, a supplier, a warehouse, serialized and non-serialized items
   (user guide section 3).
4. Run the cases in order inside a file; later cases reuse earlier data
   (noted under **Needs**).
5. For each case tick **Pass / Fail / Blocked**, write the tester, date and
   the document number or screenshot as evidence. A **Fail** gets a short
   description and, when confirmed, a GitHub issue.
6. Cases marked **Not testable yet** describe acceptance items whose feature
   is not built (the reason is given); they stay in the script so the gap is
   visible and are run once the feature lands.

## Result legend

- **Pass** — the expected result happened exactly.
- **Fail** — anything else (wrong number, wrong status, missing check, error).
- **Blocked** — could not run (environment, missing data, depends on a failed case).
- **N/T** — not testable yet (feature not built).

## Sign-off

Each file ends with a sign-off table: tester, reviewer (business owner of
the module), date, decision (`accepted` / `accepted with notes` /
`rejected`). Record the outcome in `docs/plan/progress.md` and move the
ERP items in `docs/plan/backlog.md` only after that sign-off.
