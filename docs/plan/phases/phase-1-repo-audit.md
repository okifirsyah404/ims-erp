# Phase 1 — Repository Audit, Skills, Docs Baseline

- **Ownership:** A (docs/auditing) — status: implemented — see `progress.md`.

## Entry criteria
- Working-tree baseline preserved (nothing reset/cleaned; unrelated user work intact).

## Work
- Audit repo status; inspect all instructions, skills, and lockfile states.
- Establish baseline checks; classify all domains with evidence.
- Reconcile existing docs; write/adapt the `.agents/docs/` set (plan docs later moved to `docs/plan/`); rewrite root
  `AGENTS.md`; keep the Turborepo managed block intact.
- Verify resolved stack versions from `bun.lock` into `stack-compatibility.md`.

## Outputs
- `.agents/docs/` (this repo's doc set) with `decisions/` and phases (now under `docs/plan/phases/`).
- `project-audit.md` with baseline-labeled failing tests.
- Decisions ADR-0001..0005 (org model, money minor-units, structured Indonesian
  address refs, Relational v2, drizzle DI boundary).

## Exit criteria
- ✅ Documentation set written; root `AGENTS.md` rewritten; doc index links resolve.
- ✅ Baseline commands run and recorded exactly (lint: pass, 6 warnings;
  unit tests: 7/32 failing pre-existing; documented).
- ⏳ ERP-0001 repo housekeeping (stale README, dead `build:libs`, deliberate
  commit of starter deletions) — moved to Phase 2 execution (set up by
  maintainer sign-off, not silently done).

## Evidence required
- `backlog.md` populated with stable `ERP-*` IDs and effort/owner/status.
- `progress.md`'s "Next executable task" set to Phase 2 work
  (ERP-0002/0003/0004/0005 chain).
