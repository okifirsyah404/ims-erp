# M03 — Subscription and Licensing

## Purpose

Tracks which customer holds which software license, for how long, and
whether it is active. Stage 1 is an admin-maintained register. Stage 2 adds
an API that one pilot application calls to validate and activate its
license automatically.

## Stage 1 scope (baseline)

- Register of contracts and license keys.
- Start/end dates and status.
- Due-date list.
- Status **updated by an administrator** (manual).

_Interpretation, needs owner confirmation:_

| Entity | Minimum fields |
|---|---|
| Application | name, code (the products Entragate licenses) |
| License contract | customer, application, package/plan, start date, end date, price, source invoice |
| License key | contract, key string, issued date, status |

- Status vocabulary: `active`, `expiring` (within N days, where N is set at
  kickoff, default 30), `expired`, `suspended`, `cancelled`.
  `expiring` is derived from the end date, not stored.
- The due-date list is filtered by window (this month, next 30 days,
  overdue) and feeds M01.
- Renewal in Stage 1: the admin extends the end date after payment is
  verified in M09, with a note.

## Stage 2 scope (baseline) — add-on: Automatic licensing API (IDR 1,250,000)

- API key, validation, activation/renewal.
- Grace period and suspension.
- Integration with **one pilot application**.

_Interpretation, needs owner confirmation:_

- Endpoints for the pilot app (machine-to-machine, authenticated with a
  per-application API key):
  - `POST /licenses/validate` (key → status, expiry, entitlements)
  - `POST /licenses/activate` (key + device/instance id → activation record)
- Renewal: a verified payment on a license invoice (M02/M09) extends the end
  date automatically (S04 "valid payment, then activation/renewal").
- Grace period: after the end date the status is `grace` for G days (set at
  kickoff) and validation still passes with a warning flag. After G days the
  status becomes `suspended` and validation fails.
- Authorized override: a permitted admin can extend, reactivate or suspend
  manually. Each override is written to the audit log (M12) with a reason.
- Every validation/activation call is logged (key, result, time) for
  support.

## Explicit limits (out of scope)

- One pilot application only. Not every app or device.
- No offline licensing (signed offline tokens, air-gapped activation).
- No specialized anti-piracy protection (obfuscation, hardware binding
  beyond a simple instance id, tamper detection).
- No customer self-service license management beyond **viewing** licenses
  in the customer portal (M12/T25).

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T09 | Subscription and license register | B | S1 10 | 168,750 |
| T23 | API keys and licensing rules | A | S2 9–14 | 750,000 |
| T24 | Licensing integration for pilot application | A | S2 15–18 | 500,000 |

T24 needs **source-code access to the pilot application** before it starts
(v5.1 p.4). Without it the task is `blocked`.

## SOPs

- **S04 Licensing:** valid payment, activation/renewal, application
  validation, grace period/suspension, authorized override.

## Controls

- API secrets and keys are stored hashed or in server config. Raw keys are
  shown once at issue time.
- The pilot app's API key can only call the validate/activate endpoints. It
  has no access to other ERP data.
- Renewal triggers only on **verified** payment (valid callback or manual
  finance verification), never on a pending one.
- Validate/activate endpoints are rate-limited. _Interpretation:_ the limit
  value is set at implementation.
- Customers see only their own licenses (M12).

## Acceptance

- UAT: the license register in U01–U20 and the API/pilot in U21–U32, per
  Excel. Scenario text is not in the repo.
- _Interpretation:_ Stage 2 tests cover the full lifecycle on the pilot app:
  active, end date passes, grace (still works, with a warning), suspended
  (blocked), payment, renewed (works again). They also cover an invalid key
  and a key belonging to another customer.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- Status transitions run from a clock-injected function with unit tests at
  each boundary (end date, end + G days).
- Validate/activate endpoints reject an invalid API key (401), an unknown
  license key and a suspended license. Tests cover each case.
- Payment-to-renewal is idempotent: the same payment reference applied twice
  extends the license once.
- Endpoint documentation and a pilot integration note are delivered for T32.

## Dependencies

- Needs: M02 (customer, license invoice), M09 (verified payment), M12 (audit,
  customer portal view).
- Provides: due-date data to M01, licenses to the customer portal.
- External: pilot application source access. The owner/IT must provide it
  before Stage 2 day 15.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` (`licensing`, 9 tables) | Code |
|---|---|---|
| Applications | `licensable_applications` | none |
| Contracts | `license_contracts`, `license_packages` | none |
| Keys | `license_keys` (plus `auth.apikeys` for the app API key) | none |
| Activations | `license_activations` | none |
| Due dates / renewals | `subscription_schedules` | none |
| Event/validation log | `license_events` | none |

- Status: **planned**. No Drizzle schema, module or UI exists.
- `beyond-baseline`: `license_entitlements` and `license_entitlement_usages`
  (usage metering/quotas) are not in v5.1. Feature flags returned on validate
  may fit inside them, but usage counting does not.
