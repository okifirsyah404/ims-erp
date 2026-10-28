> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Product Module

## Purpose and boundary

Sales catalog: products and services, categories, units. One catalog entity
with a type discriminator (products carry SKU/stock flag/optional serial
tracking; services carry code/description/unit/price) — decision recorded for
Phase 3, no duplicated tables (commercial T03; master data catalog in
`../domain-map.md`).

## Current state (audit, 2026-10-25)

**Scaffold only:**

- `modules/product/**` — empty stubs; registered in `app.module.ts`.
- Pre-written unit specs (controller/service) exist.

## Data ownership (planned, Phase 3)

- `erp.products` — type (`product` | `service`), SKU/code (unique alive),
  name, category ref, unit ref, selling price (**integer IDR minor units**),
  stock flag, serial-tracking policy (optional), status/deleted_at.
- `erp.categories`, `erp.units` — consistent definitions (units, sets,
  pieces, packages, months, years) — shared master data, owned here.
- Subscription package linkage (software/product + duration + price +
  renewal policy) is a licensing/subscription concern — reference by id from
  there (see [licensing-subscription](licensing-subscription.md)).

## Behavior targets

- CRUD + deactivate with permission gates; catalog used by sales (SPH/invoice
  lines), purchasing (supplier items), inventory (stock flag → movements),
  licensing (software products).
- Prices in minor units end-to-end; no floats in JSON.

## Dependencies and rules

- Pure master data — depended on by sales/purchasing/inventory/licensing.
  Keep its public surface (search-by, price-at-time-of-document semantics)
  stable; documents snapshot prices at creation (financial-correctness rule).

## Tests

- Existing stub specs to replace.
- Required: unique SKU on alive rows (partial index + 23505→409), category/
  unit referential integrity, price serialization invariance (integers only).
