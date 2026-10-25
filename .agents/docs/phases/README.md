# Development Phases — Index

Technical phases map onto the two commercial stages but never replace them.
Each phase file defines entry criteria, work, exit criteria, outputs, ownership
(A/B = two programmers), dependencies, and required evidence. Exit criteria
draw straight from `backlog.md` IDs and the invariants in `security-and-access`
and `data-model` docs.

| Phase | Directory file | Core deliverable | Depends on |
|---|---|---|---|
| 1 | phase-1-repo-audit.md | repo integrity + docs baseline | — |
| 2 | phase-2-auth-access-customer-slice.md | runtime-auth proof + customer vertical slice | 1 |
| 3 | phase-3-core-master-data.md | master data, org settings, COA, opening data | 2 |
| 4 | phase-4-sales-purchasing-accounting.md | transactional core + posting | 3 |
| 5 | phase-5-reports-tax-period-close.md | reports, tax, assets/projects, profit sharing, close | 4 |
| 6 | phase-6-payroll-subscription-portals.md | payroll, licensing, gateway, WhatsApp, portals | 4–5 (per item in backlog) |
| 7 | phase-7-uat-release.md | UAT, reconciliation, backup, release prep | 6 |

## Global rules

- `planned → in-progress → implemented → verified → accepted` — move statuses
  only with evidence in `progress.md`.
- Business gates (profit-sharing scheme, tax parameters, payroll components,
  provider credentials/sandbox access) mark the corresponding phase start
  `blocked` until supplied. Documented blockers are part of honest forecasting,
  not failures.
- No production deployments, no live contacts/messages, no charges without
  explicit business authorization. Sandboxes/mocks until approval.
- Two programmers: no overlapping full-capacity tasks on the same module;
  ownership columns in `backlog.md` tracks this.
