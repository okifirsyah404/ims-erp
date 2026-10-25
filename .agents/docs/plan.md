# Plan

Goals, priorities, dependencies, and forecast. The commercial agreement
(IDR 12,000,000 = 5.4M stage-1 + 6.2M stage-2 + 0.4M contingency; target
2026-10-25 → 2026-11-23, 30 calendar days, two programmers) is the business
frame — not evidence of engineering feasibility. No fabricated progress; no
invented task prices; no claim of full completion by 2026-11-23.

## Scope frame (do not silently cut)

Preserved across both commercial stages: payroll automation, checkout/payment
gateway, WhatsApp AI, automated licensing, customer portal, investor portal.
The original 12-group/13-SOP/32-task mapping is not reproducible in-repo; it
is `pending` and engineering IDs stand in until authoritative files arrive.

## Priority ladder

1. Make the ground real: authorization core + runtime-verified auth (most
   architectural and most uncertain; everything else rests on it). Phase 2.
2. Reference vertical slice (customer CRM) through UI, tests, migration. Phase 2.
3. Remaining master data + COA + opening-data facilities (financial
   correctness foundations). Phase 3.
4. Transactional core: sales/invoice/receivables, purchasing/payables,
   expenses, journal posting. Phase 4.
5. Inventory valuation boundaries, assets/projects, reports/tax, profit
   sharing, period close. Phase 5.
6. Payroll, subscription/licensing, gateway checkout, WhatsApp AI, portals —
   dependency-ordered. Phase 6.
7. UAT/reconciliation/backup/release prep. Phase 7.

## Assumptions

- Disposable PostgreSQL available locally/CI for checks (env-provided).
- Gateway, WhatsApp, licensing, hosting providers are business-provided
  credentials at phase 6 time; none may be assumed to exist yet.
- Real acceptance requires business reviewer approval (test pass ≠ accepted).

## Dependencies and gates

- **Auth gate:** no portal/permission feature is safe before Phase 2 auth
  verification completes.
- **Ledger gate:** no financial posting feature ships before `data-model.md`
  Money (ADR-0002) and journals machinery (Phase 3/4) exist.
- **Business-decision gates:** profit-sharing scheme approval; tax parameter
  approval; payroll component approval; each blocks the corresponding phase.
- **Provider onboarding gate:** phase 6 integrations require real approved
  credentials/sandbox from the business.

## Forecast vs 30-day target

Two programmers, dependency-ordered (no overlapping full-capacity same-module
tasks):

| Window (indicative) | Programmer A | Programmer B |
|---|---|---|
| Days 1–5 | Phase 1+2: auth core, customer slice backend | Phase 1+2: web-admin shell, customer slice frontend |
| Days 6–12 | Phase 3: master data + COA | Phase 3: org settings, opening data, address model polish |
| Days 13–21 | Phase 4: sales/invoices/receivables | Phase 4: purchasing/payables/expenses |
| Days 22–27 | Phase 5: reports/tax/profit share | Phase 5: assets/projects/valuation |
| Days 28–30 | Phase 6 first threads (payroll/licensing) | Phase 6 first threads (gateway sandbox) |

Honest variance: Phases 4–6 require posting correctness, provider approvals,
and validation volume that 30 days cannot guarantee. Commitments are revised
by business review before any external promise. Risks with
mitigations:

| Risk | Mitigation |
|---|---|
| Auth integration unverified at runtime | force proof-of-life login + e2e immediately in Phase 2 |
| drizzle rc channel churn | exact pins; no opportunistic upgrades |
| Redis availability needed to boot locally | decide/document fallback behavior if Redis is unavailable |
| Business decisions late (scheme/tax/payroll) | mark tasks blocked; sequence others; keep docs in date |
| Two programmers on one codebase | module boundary conventions + task ownership columns in backlog |

## Next actions (post-docs)

1. Phase 2 execution: implement `src/core/authorization/*` per the
   pre-written specs; build out `modules/auth`; repair the `user` stub suites.
2. Customer slice (backend → frontend → migration → seed → tests), closing
   pre-existing failing suites along the way.
3. Backlog hygiene after the slice: split Phase 3+ into task IDs.
