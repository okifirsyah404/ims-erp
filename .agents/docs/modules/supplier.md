# Supplier Module

## Purpose and boundary

Supplier/vendor master data: code, name, address, contact person, payment
terms, and **bank details under restricted access** (masked in lists;
permission-gated detail; audited when revealed/exported).

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/supplier/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 3 — commercial T03/T07)

- `erp.suppliers` — code (unique alive), name, address, contact person,
  payment terms, bank details (restricted columns), status/deleted_at.
- Transactional links (bills, payables) belong to purchasing; payments to
  payment/finance.

## Behavior targets

- CRUD + deactivate (soft) with permission gates; bank detail access tested
  for denial by default roles.
- Referenced by purchasing bills; supplier payments never bypass the
  payables state (S06/S11 chain).

## Dependencies and rules

- Pure master data consumed by purchasing/payment via contracts. No finance
  posting logic here.

## Tests

- Existing stub specs to replace.
- Required: unique supplier code (partial unique, 23505→409), bank-detail
  masking on list responses, restricted detail read permission-denial,
  soft-delete filtering, audit on sensitive detail access.
