> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# M08 — Employees and Attendance

## Purpose

Employee records, manual attendance, leave/overtime and the salary/bonus
summary. Stage 2 adds automated payroll: salary components, payslips,
approval and the payroll journal, all calculated from entered or imported
attendance.

## Stage 1 scope (baseline)

- Manual attendance.
- Tasks, leave and overtime.
- Salary and bonus summaries, **entered or imported**, then approved.

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Employee | name, NIK, position, join date, status, bank account, base salary | `active` / `inactive` |
| Attendance | employee, date, status (`present`, `absent`, `leave`, `sick`, `holiday`), check-in/out time (optional) | — |
| Leave / overtime request | employee, type, date range or hours, reason | `submitted → approved / rejected` |
| Salary summary | period, employee, gross, deductions, bonus, net (entered or imported from Excel) | `draft → approved` |

- Attendance is entered by an admin or imported from a spreadsheet (CSV/XLSX
  template defined at kickoff).
- "Tasks" means work assigned to employees outside projects. _Interpretation:_
  a simple per-employee task list. Project tasks live in M07.
- Approved salary summaries are posted to M09 by finance as a journal. This
  is manual in Stage 1.

## Stage 2 scope (baseline) — add-on: Automated payroll (IDR 1,000,000)

- Automated payroll from entered/imported attendance and salary components.
- Payslips.
- Approval.
- Journal entries.
- **One company policy.**

_Interpretation, needs owner confirmation:_

- Components: earnings (base, fixed allowances, overtime from approved
  overtime hours × rate) and deductions (absence, BPJS employee share, PPh 21
  as a **flat or table rate given by finance**, loans/advances). The exact
  list and formulas are fixed at kickoff and are a business gate.
- Run flow (S10): open the period, pull approved attendance/overtime,
  calculate, finance reviews, the owner approves, payslips are generated,
  the journal is posted (expense + payroll liability), and payment is
  recorded (manual transfer, marked paid).
- A recalculation is allowed only before approval. After approval,
  corrections go into a new adjustment run.
- Employees get payslips as PDFs. _Interpretation:_ distributed by admin;
  there is no employee app (M12 limit).

## Explicit limits (out of scope)
> **ADR-0030 (2026-11-25, proposed):** the finance ERP-grade extension lifts some of the limits below (see the ADR's "Limits lifted" table). Until the owner records the scope change, the limits here remain the contract baseline.


- No attendance machine, fingerprint or GPS integration.
- No complex shifts or rotating schedules.
- No bulk bank transfer file or payment API.
- Not every payroll-tax scenario (no full PPh 21 TER engine, no annual
  1721-A1 reconciliation, no multiple policies).
- No employee self-service app.

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T10 | Employees, attendance, and salary summary | B | S1 11 | 168,750 |
| T19 | Automated payroll calculation | A | S2 1–5 | 600,000 |
| T20 | Payroll payslips, approval, and journals | A | S2 6–8 | 400,000 |

T19 is `blocked` until the salary component rules are supplied (v5.1 p.8,
phases README "business gates").

## SOPs

- **S10 HR:** attendance/component input, calculate salary, review/approval,
  payslip, journal/payment.

## Controls

- Payroll is posted **only after approval** (v5.1 p.9).
- The payroll journal reference is unique per run, so it posts once.
- Salary data is restricted to the HR/finance/owner roles. Employees and
  other staff cannot read other people's salaries, and this is checked on the
  server, including exports.
- Bank account numbers and NIK are personal data. Show them masked in lists.
- Money is integer IDR minor units, with the rounding rule fixed at kickoff
  and tested.

## Acceptance

- UAT: HR scenarios in U01–U20 and payroll scenarios in U21–U32, per Excel.
  Scenario text is not in the repo.
- _Interpretation:_ the tests cover a sample month calculated by hand by
  finance that matches the system to the rupiah, an attempt to change an
  approved run (rejected), and a journal posted once (debit expense, credit
  payroll payable).

## Definition of Done

Common DoD in [README.md](README.md), plus:

- The payroll calculation is a pure function with unit tests from finance's
  worked examples.
- An attendance import validates every row and reports errors per row. A
  partial bad file imports nothing.
- Payslip PDFs are produced in Indonesian.
- The salary access denial test passes for a non-HR role.

## Dependencies

- Needs: T03 master data (positions, departments), M09 (payroll expense and
  liability accounts, journal posting contract).
- Provides: employees to M06 (PIC/borrowers) and M07 (assignees), payroll
  totals to M01, the payroll liability to M09 reports.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Employees | `hr.employees` (+15 tables) | none (Better Auth `users` exist, but they are logins, not employees) |
| Attendance | `hr.attendance_records`, `attendance_corrections` | none |
| Leave | `hr.leave_types`, `leave_requests` | none |
| Overtime | (no explicit table; may be `payroll.payroll_inputs`) | none |
| Payroll | `payroll` (11 tables: components, periods, runs, payslips, items, inputs, adjustments, payments, BPJS) | none |

- Status: **planned**.
- `beyond-baseline`: `hr.disciplinary_records`, `training_records`,
  `certifications`, `employee_transfers`, `separation_records`,
  `employee_documents`, `employment_contracts` (as a workflow) and
  `payroll.payslip_acknowledgements`. `payroll_payments` /
  `payroll_payment_items` are fine as a paid flag but must not grow into a
  bulk transfer.
- Gap: overtime has no clear table.
