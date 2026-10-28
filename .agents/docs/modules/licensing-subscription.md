> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Licensing & Subscription Module (owner to be created)

## Purpose and boundary

Software subscription contracts and the licensing API: packages, contracts,
activation/renewal, validation, grace period/suspension. v5.1 M03 limits:
**one pilot application**; excludes all-app/device coverage, offline
licensing, and specialized anti-piracy protection. Stage 1 is a manual
register (contract/key register, start/end status, due-date list, admin
updates — T09); stage 2 adds the API (T23–T24).

## Current state (audit, 2026-10-25)

**Absent — no module directory.** Subscription packages are master data in
`../domain-map.md` (#11–12); product linkage exists conceptually via the
product catalog. No tables yet.

## Planned ownership (stage 1 register in Phase 3; API in Stage 2)

- `erp.subscription_packages` — software/product ref (product catalog),
  duration, price (minor units), renewal policy.
- `erp.subscriptions` (contracts) — customer ref, package ref, start/end,
  status (active/grace/suspended/expired), renewal history.
- `erp.license_keys` — key, subscription ref, activation state,
  activation/renewal events (replay-safe), validation endpoint audit trail.

## Behavior targets

- Stage 1 (T09): manual register with admin updates; due-date list feeding
  the dashboard (M01).
- Stage 2 (T23–T24): API keys + validation for the pilot application;
  activation/renewal tied to **verified business events** (valid payment per
  S04: valid payment → activation/renewal → application validation →
  grace/suspension → authorized override); expiry/suspend rules; replay-safe
  processing; refund/reversal consequences defined **before** implementation
  (per `../data-model.md` invariants).
- Authorized overrides are permission-gated and audited.

## Dependencies and rules

- Consumes product (packages), customer (subscriber), payment (verified
  payment events — via contracts, never trusting redirects), notification
  (expiry/suspension notices). License state changes must be idempotent;
  events after local commit only.

## Tests

- None exist. Required: replay-safe activation (duplicate event = one
  state change), grace/suspension transitions, validation against verified
  payment only, refund/reversal path once defined, pilot-app contract
  tests against the sandbox.
