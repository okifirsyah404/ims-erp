# Phase 7 — Cross-Module UAT, Reconciliation, Backup, Release Preparation

- **Owner:** A + B jointly, with designated reviewer approval recorded.
- **Depends on:** Phase 6 functional scope; not a substitute for it — items
  blocked in Phase 6 remain blocked here and must be excluded from any release
  notes claim.

## Work (ERP-0024, ERP-0025)
1. **ERP-0024 cross-module UAT:** end-to-end scripts for the full business
   story (quote → invoice → payment → posting → reports → period close;
   payroll run + payslip; subscription renewal; gateway sandbox checkout;
   WhatsApp sandbox Q&A; portal journeys).
2. **Reconciliation battery:** subledger ↔ GL controls; balance-sheet
   equation; opening equity invariants; receivable settlement no-double-revenue
   check; tax recap vs configured parameters.
3. **Backup/restore drill** on staging-like data (verify + record in
   `runbook.md`).
4. **ERP-0025 release prep:** runbook verified end-to-end on a staging host;
   operational documentation (env names, on-call basics sane); doc set
   final update; ADRs for any decisions made along the way.

## Exit criteria
- UAT pass with an actual business reviewer's approval per slice (recorded in
  `backlog.md` as `accepted`; automated green alone is not acceptance).
- Backup/restore verified by executing it (not by believing the command).
- Documentation set current; `progress.md` handoff points to long-term
  maintenance ownership and the first post-release task.

## Outputs
- Verified UAT scripts + results, backup/restore evidence, release checklist
  status, updated reports/runbook.
