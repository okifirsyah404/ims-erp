# UAT — M08 Employees and Attendance

Scope: employees (ERP-0034) with bank account and leave balance, attendance
(daily and import), leave, overtime, tasks, monthly salary summary with the
owner's approval. User guide section 8.6. **Needs PR #83** in the build.
Plan acceptance: a month calculated by hand by finance matching the system to
the rupiah, a change to an approved run refused, a journal posted once (see
[README](README.md)).

| ID | Title | Result | Tester / date |
| --- | --- | --- | --- |
| UAT-M08-01 | New employee, invitation, bank account | | |
| UAT-M08-02 | NIK and account masked without private access | | |
| UAT-M08-03 | Daily attendance and monthly recap | | |
| UAT-M08-04 | Attendance import: one bad row imports nothing | | |
| UAT-M08-05 | Leave: Sundays excluded, 12-day quota, no self-approval | | |
| UAT-M08-06 | Approved leave appears in attendance; cancel returns days | | |
| UAT-M08-07 | Overtime approved, shown in the salary summary | | |
| UAT-M08-08 | Month by hand = system to the rupiah | | |
| UAT-M08-09 | Approved month cannot be changed | | |
| UAT-M08-10 | Payroll journal posted once | N/T | |

---

### UAT-M08-01 New employee, invitation, bank account
- **Role:** HR
- **Steps:** HR & Attendance → Employees → New employee (NIK, email, phone,
  join date). Add the salary bank account.
- **Expected:** employee listed; an invitation email is sent for their
  login; leave balance shows 12 days for this year.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-02 NIK and account masked without private access
- **Role:** a role without `employee:read_private` (e.g. operations manager)
- **Steps:** Open the employee from M08-01.
- **Expected:** NIK and account number partly hidden; HR / owner see them in
  full.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-03 Daily attendance and monthly recap
- **Role:** HR
- **Steps:** Attendance: pick a date, Mark empty rows present, set one
  employee sick and one absent, times for one; Save day. Open Monthly recap.
- **Expected:** saved statuses reload the same; the recap counts present /
  sick / absent per employee for the month.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-04 Attendance import: one bad row imports nothing
- **Role:** HR
- **Steps:** Download the template; fill 5 rows, one with an unknown
  employee or a bad status; upload. Fix the row; upload again.
- **Expected:** first upload imports nothing and lists the wrong row; the
  second imports all 5.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-05 Leave: Sundays excluded, 12-day quota, no self-approval
- **Role:** HR + owner
- **Steps:** Record annual leave Friday → Monday (one Sunday inside). The
  recorder tries to approve; owner approves. Record annual leave that would
  bring the year above 12 days.
- **Expected:** the leave counts 3 days, not 4; self-approval refused; the
  balance drops by 3; the over-quota request is refused (waiting requests
  count too).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-06 Approved leave appears in attendance; cancel returns days
- **Role:** HR
- **Steps:** Open attendance for those dates; then Cancel the leave.
- **Expected:** the days show *leave* automatically; after cancel the
  balance is back.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-07 Overtime approved, shown in the salary summary
- **Role:** HR + owner
- **Steps:** Record 3 hours overtime; someone else approves.
- **Expected:** approved hours appear next to the employee in that month's
  salary summary.
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-08 Month by hand = system to the rupiah
- **Role:** HR + finance
- **Steps:** Payroll: pick the month, Fill from last month; enter for three
  employees base, allowances, overtime pay, bonus and deductions (or
  Import). Finance computes net pay by hand beforehand.
- **Expected:** net pay = base + allowances + overtime + bonus −
  deductions, equal to the hand figures to the rupiah for every row and the
  month total. (There is no automatic payroll calculation yet — stage 2.)
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-09 Approved month cannot be changed
- **Role:** owner, then HR
- **Steps:** Owner approves the month. HR tries to edit a row, import, or
  fill again.
- **Expected:** all changes refused; the month shows approved by and when.
  Only the owner can approve (HR cannot).
- **Result:** ☐ Pass ☐ Fail ☐ Blocked — evidence:

### UAT-M08-10 Payroll journal posted once
- **Status:** **N/T** — payslips, payroll calculation and the payroll
  journal (T19/T20, ERP-0018) are not built; they need the payroll rules
  from finance. When built: approving a run posts one journal (debit salary
  expense, credit payroll payable) and re-approving never posts a second.

---

## Sign-off

| Tester | Reviewer (business) | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
