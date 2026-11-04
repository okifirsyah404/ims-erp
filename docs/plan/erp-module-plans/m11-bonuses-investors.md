# M11 — Bonuses and Investors

## Purpose

Records who put capital in and who is entitled to a share. Applies **one**
profit-sharing scheme to the period's distributable profit, gets owner
approval and tracks payments. Stage 2 lets each investor see their own
capital, share, approved returns and payment history in a portal.

## Stage 1 scope (baseline)

- Register of capital and recipients.
- **One** profit / reserve / share scheme.
- Approval and payment history.
- Bonus summaries are **manual**.

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields | Status flow |
|---|---|---|
| Recipient (investor) | name, type (investor/partner/employee-bonus), contact, bank account | `active` / `inactive` |
| Capital record | recipient, date, amount, evidence | — (deposits/withdrawals log) |
| Scheme | reserve %, share % per recipient (sum = 100% of the distributable part), profit basis (`before_tax` / `after_tax`), loss carry-forward rule | one active version; changes create a new version |
| Distribution run | period, P&L profit (from M09), prior losses, reserve, distributable amount, lines per recipient | `draft → approved (owner) → published → paid` |
| Payment | run line, date, amount, evidence | — |

- Distributable profit = period profit (from M09 reports, closed period only)
  − prior losses still to recover − reserve. Basis and rule are set by the
  owner at kickoff (a business gate).
- Bonus summary: entered manually (amount per recipient per period), then
  approved and paid. There is no calculation.
- Payment posts through M09 (debit profit-share payable / equity, credit
  bank).

## Stage 2 scope (baseline) — add-on: Investor portal (IDR 750,000)

- The investor portal shows the investor's **own** capital, share, approved
  returns and payment history.
- The investor can export their own data.

_Interpretation, needs owner confirmation:_

- Only `published` runs are visible (S12 "publish to portal"). Drafts and
  unapproved runs never are.
- The investor sees their own line and the run totals the owner chooses to
  publish. _Proposed:_ distributable total yes, other investors' lines no.
- Exports: PDF/CSV of the investor's own history.

## Explicit limits (out of scope)

- One profit-sharing scheme only (versioned, but one active).
- No automatic commissions (sales commission, referral fees).
- No schemes with multiple contracts (per-project or per-tranche terms).
- No investor self-service deposits or withdrawals.

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T13 | Investor bonuses and profit sharing | B | S1 13 | 168,750 |
| T29 | Capital and profit-sharing dashboard | B | S2 19–22 | 500,000 |
| T30 | Data permissions and investor exports | B | S2 23–26 | 250,000 (shared with M12) |

T13 is `blocked` until the owner supplies the scheme (basis, reserve,
shares, loss rule).

## SOPs

- **S12 Profit sharing:** distributable profit, scheme/reserve, owner
  approval, publish to portal, payment/journal.

## Controls (v5.1 p.9)

- Profit basis, prior losses, reserve and shares are **approved by the
  owner**. Only the owner role can approve a run.
- **Tax is not deducted twice** when the basis is after-tax profit (M10).
- A run uses a **closed** M09 period only, so its profit figure cannot change
  afterwards.
- Share percentages must sum correctly. This is validated on the server.
- Investors access **only their own** data, including exports and downloads
  (v5.1 p.9). Cross-account access is tested (M12).
- Money is integer IDR minor units. The rounding remainder rule is fixed and
  tested (for example, the remainder goes to the reserve).

## Acceptance

- UAT: scheme/approval/payment scenarios in U01–U20 and investor portal
  scenarios in U21–U32, per Excel. Scenario text is not in the repo.
- _Interpretation:_ the tests cover a sample period that matches the owner's
  manual calculation, investor A trying to see investor B's data (denied),
  and an unpublished run (invisible in the portal).

## Definition of Done

Common DoD in [README.md](README.md), plus:

- The distribution calculation is a pure function with unit tests (loss
  carry-forward, reserve, rounding, after-tax basis).
- The run state machine is enforced on the server: no `published` without
  `approved`, and only the owner approves.
- Portal and export endpoints have cross-account denial tests.

## Dependencies

- Needs: M09 (closed-period profit, posting contract), M10 (after-tax
  basis), M12 (investor accounts, data restrictions).
- Provides: profit-sharing liabilities/payments to M09 and the investor view.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` (`investor`, 11 tables) | Code |
|---|---|---|
| Recipients | `investors`, `investor_addresses` | none |
| Capital | `capital_commitments`, `capital_deposits` | none |
| Scheme | `profit_share_schemes`, `profit_share_scheme_entries` | none |
| Runs / shares | `profit_distribution_runs`, `profit_shares` | none |
| Portal identity | `auth.portal_identities` | none |

- Status: **planned**.
- `beyond-baseline`: `fund_allocations` (tracking use of funds),
  `investor_meetings` and `investor_reports` (as a report generator).
  `capital_commitments` (committed vs. deposited) goes beyond a "capital
  register".
- Gap: the employee bonus summary has no obvious table. It may sit in
  `payroll.payroll_adjustments` or need a small table here.
