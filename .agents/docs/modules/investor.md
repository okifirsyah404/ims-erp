> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Investor Module (owner to be created)

## Purpose and boundary

Investor master data, capital records, and the single approved profit-sharing
scheme with distributions and payment history (v5.1 M11; tasks T13, T29–T30;
S12). **One profit-sharing scheme**; no automatic commissions, no
multiple-contract schemes. The investor portal (stage 2, T29–T30) is
**read-only** for an investor's own capital, share, approved returns, and
payment history, plus exports.

## Current state (audit, 2026-10-25)

**Schema only — module absent:**

- `erp.investors` exists in the baseline migration: `id`, `name`, `email`,
  `phone`, `status`, `ownership_share` (text placeholder — comment in schema
  states exact portion/reserve configuration is business data governed by
  owner approval), timestamps, `deleted_at`, status index.
- No module directory, no service/repository code.

## Planned ownership (Phase 5; portal in Stage 2)

- `erp.investors` — extend: code, contacts, bank details (restricted),
  portal identity link (auth user), archive behavior.
- `erp.investor_capital` — capital records per investor (source, date,
  amount minor units, traceable refs).
- `erp.profit_sharing_runs` — approved distributable amount, reserves,
  prior profit/loss policy applied, scheme snapshot at approval time.
- `erp.investor_distributions` — per-investor share of an approved run,
  state (approved → published to portal → paid), journal ref, payment
  history refs.

## Behavior targets

- Scheme parameters (profit basis, prior losses, reserves, shares) require
  **owner approval** before use (v5.1 financial controls) — store the
  approved snapshot with each run.
- No double tax subtraction when the basis is after-tax profit (v5.1
  control; see [tax](tax.md)).
- Distributions publish to the portal only after owner approval (S12:
  distributable profit → scheme/reserve → owner approval → publish →
  payment/journal).
- Payment execution via payment/finance; balances reconcile to GL.

## Dependencies and rules

- Consumes finance (posting, reports for profit base), tax (after-tax base),
  payment (payouts), auth/identity (portal user link). Portal scoping:
  investor A never sees investor B (server-side, including exports/APIs —
  v5.1 access requirement).

## Tests

- None exist. Required: approval-gated distribution creation,
  scheme-snapshot immutability, after-tax invariant, payout
  idempotency/reconciliation, portal scoping tests (investor A × investor
  B), export permission tests.
