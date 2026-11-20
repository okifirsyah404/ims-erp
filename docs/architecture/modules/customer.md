> **Deprecated (ADR-0024, 2026-11-20).** This page describes the pre-refactor module "customer (CRM-era audit)". It is kept for history. Current owner: customer (schema `customer`) - see docs/database/module-ownership.md.
> Mapping: crm -> customer; crm leads -> project.leads; contacts and portal login -> customer.customers.

> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Customer Module

## Purpose and boundary

Customer master data and CRM adjacency: company-wide customer records,
contacts, lead/follow-up data (CRM is commercial M02 — leads/follow-ups are
recorded manually in Stage 1; no fully-automated CRM), structured Indonesian
addresses, optional tax identity. Customer **portal-facing identity**
(orders/invoices visibility) is enforced through sales/payment ownership
checks, with ERP-0022 wiring later.

## Current state (audit, 2026-10-25)

**Partially implemented — schema real, code scaffold.**

- Schema `erp.customers` (in baseline migration): `id` text PK, `name`,
  `email`, `phone`, `status` default `'active'`, unix-ms timestamps,
  `deleted_at` nullable, `customers_status_idx` index. No code/address
  columns yet.
- `repositories/customer.repository.ts` — scaffold with two `findById`
  variants; **imports `drizzleDB` directly (ADR-0005 violation to fix)**;
  a questionable `scopeId` compare against `customers.id` (pre-tenancy
  experiment; supersede with authorization-side ownership checks).
- `controllers/customer.controller.ts`, `services/customer.service.ts`,
  `customer.module.ts` — registered, empty stubs.
- Specs exist: controller spec mocks unknown methods already (candidate API
  names `me`, `findOneForUser` came from a stale assumption — re-plan routes
  rather than bending endpoints to the mocks).

## Key files

- `src/providers/drizzle/schemas/erp-schema.ts` (table def)
- `src/modules/customer/**`
- planned: `database/seeders/seed/customer.seeder.ts` (synthetic, idempotent,
  reusing the existing runner)

## Data ownership

- `erp.customers` (to be extended, Phase 2 — task ERP-0004/0006):
  - `code` — unique business code; **partial unique index** on alive rows;
    race conflicts surface as PG `23505` → service maps to 409.
  - customer type (individual/company), contact person, tax identity.
  - Address per ADR-0003: free-text street + province/regency/district/
    village references. Reference tables seeded idempotently from
    `database/seeders/raw/addresses/*.json` — never guess codes; **no address
    JSON in the browser bundle**; lookup via cached, paginated API
    (ownership of reference tables: this module).
- Leads/follow-ups (commercial S01): data model decided with the slice, but
  Stage 1 has them manual (no automation promised).

## Behavior targets (Phase-2 slice; commercial T03/T05)

- List with server-side pagination/search/sort (envelope per
  `../api-conventions.md`); detail; create; update; deactivate (soft), never
  hard-delete.
- Permissions: internal roles via matrix (`crm.lead.*` analog for customers;
  exact permission names sync with `web-admin/lib/permissions.ts`).
- Ownership: customer-portal users see only their own identity-linked records
  (later phases; enforce hooks from the start).
- Cache: id-scoped reads only; evict on write; no stale authorization.

## Dependencies and rules

- Depends on authorization (and authentication for session context),
  infrastructure tokens. Notification module consumes customer.target contact
  where CRM notifications land later.
- `user` module is the code pattern to mirror (contracts/dto layering).

## Tests

- Existing scaffolding specs (controller/service) — upgrade to real endpoint
  + service tests.
- Required (Phase-2 exit): integration tests on disposable PG — unique-code
  race (23505→409), pagination totals, soft-delete filtering, address FK
  chain integrity; e2e — session, authorization denial, CRUD, deactivation;
  Relational v2 query exercising a real declared relationship.
