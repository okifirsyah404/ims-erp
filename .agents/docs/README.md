# Documentation Index — IMS/Entragate ERP

Agent-facing documentation lives here. Keep documents short, synchronized with
verified code, and updated in place. When a document and the code disagree, fix
whichever is wrong and note it in `progress.md`.

## First session / resume reading order

1. `../AGENTS.md` (repo root) — hard rules and definition of done
2. `project-audit.md` — what exists, what works, known failures
3. `stack-compatibility.md` — exact resolved versions and risks
4. `runbook.md` — verified commands and environment variable names
5. `architecture.md` — module boundaries and DI rules
6. `domain-map.md` — business capability ownership and scope boundaries
7. `progress.md` — latest state; start where the doc says work stopped

Reference when touching the relevant areas:

| File | Read when |
|---|---|
| `data-model.md` | adding/changing tables, keys, money, or dates |
| `api-conventions.md` | adding/changing endpoints |
| `security-and-access.md` | touching auth, permissions, portals, audit |
| `skills.md` | checking available agent skills |
| `backlog.md` | picking or planning work (stable task IDs) |
| `phases/` (`docs/plan/phases/`) | phase entry/exit criteria and dependencies |
| `modules/` | per-technical-module boundaries, state, data ownership, tests |
| `decisions/` | architectural decision records (ADRs) |
| `testing-strategy.md` | writing tests |
| `docs/plan/plan.md` | goals, priorities, forecasting; commercial plan in `docs/plan/erp-plan-en.md` / `erp-plan-id.md`; feature plans in `docs/plan/plans/` |

Database schema documentation lives outside this folder, in
`docs/database/` (repo root): `docs.dbml` (canonical persistence contract),
5 companion MDs (`module-ownership`, `integrity-and-consistency`,
`data-dictionary`, `logical-references`, `implementation-phases`), and the
`gen-logical-references.ts` / `validate-dbml.ts` scripts.

Any backend feature work reads that folder first and runs the `grill-me`
design interview; see **Feature module lifecycle** in `../AGENTS.md`.

## Conventions

- Statuses: `planned`, `in-progress`, `implemented`, `verified`, `accepted`,
  `blocked`. Automated tests passing is not business acceptance; `accepted`
  requires an actual reviewer's approval.
- Commands marked **verified** were actually run and passed. Anything else is
  *proposed* and must be verified before being recorded as working.
- Environment variables are referenced by name only — never by value.
- All content in English except preserved Indonesian business UI copy references.
