# Phase 6 — Payroll, Subscription/Licensing, Gateway, WhatsApp AI, Portals

- **Owner:** A (payroll, investor/customer portal identities) + B
  (subscription/licensing, gateway, WhatsApp).
- **Depends on:** Phase-4/5 postings; **provider gates** (one gateway provider
  credential/sandbox; one WhatsApp number/provider with approved usage) —
  track as `blocked` until the business supplies them; sandbox/mock until
  live-use approval exists.

## Work (ERP-0018, ERP-0019, ERP-0020, ERP-0021, ERP-0022, ERP-0023)
1. **ERP-0018 payroll:** employee master → approved inputs →
   salary components/rules → run → approval → payslip → journal posting.
   Agreed statutory coverage only (scope boundary in `domain-map.md`).
2. **ERP-0019 subscription & licensing:** packages, contracts, renewal,
   activation/validation, expiry/suspend, replay-safe processing; one pilot
   client application; refund/reversal consequences decided **before**
   implementation.
3. **ERP-0020 checkout & gateway:** one provider, sandbox first; webhook
   authenticity, amount/currency/order checks, event uniqueness + idempotency
   + retries + out-of-order safety; browser redirect is never proof of
   payment; no live charges without written authorization.
4. **ERP-0021 WhatsApp AI:** one number/provider; answers only from approved
   FAQ knowledge; lead capture; human handoff; untrusted-message policy tests
   (no overrides of system rules or financial actions); mock/sandbox until
   approved.
5. **ERP-0022 customer portal:** self-scoped orders, invoices, payments,
   projects/licenses, tickets; cross-customer access tests.
6. **ERP-0023 investor portal:** read-only own capital, approved
   distributions, payment history + profit-sharing distribution approval flow
   backend.

## Exit criteria
- Payroll run: approval-gated, journal-posting reconciles to PSP/management
  ledger control; payslip generated and immutable once posted (corrections via
  traceable entries).
- License flows: activation/renewal/suspend/expiry replay-safe; expiry rules
  tested (suspend on expiry, reactivate on verified payment).
- Gateway sandbox: duplicate/delayed/out-of-order webhook tests; idempotency
  keys; signature verification failure paths.
- Portals: unauthorized-access tests pass (customer A × customer B; investor
  A × investor B); no session fixation/leakage in portal routes.
- External effects after commit only (outbox decision recorded where used).

## Outputs
- New module code (owners per `domain-map.md`), integration adapters behind
  interfaces, portal routes, docs updates, sandbox demo evidence.
