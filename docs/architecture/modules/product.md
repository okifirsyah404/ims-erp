# Product Module

Own schema: **`product`** (ADR-0026, accepted 2026-11-23, which split it out of
`inventory`). 6 tables. Tables, contracts and columns: `docs.dbml` (canonical)
and `docs/database/module-ownership.md` (profile 6).

> This page was rewritten 2026-11-24. The pre-refactor "product / catalog"
> page (NestJS-era stubs, `erp.products`) is history only and no longer
> describes the module.

## Purpose and boundary

The product (SKU) master and its website listing: what the company sells,
without any stock truth. Stock balances, the ledger, serial units, borrowings
and tools stay in `inventory`; the physical estate stays in `warehouse`.

## Tables (`product` schema)

| Table | Holds |
|---|---|
| `product.products` | SKU master: code, name, kind, category, prices (integer IDR minor units), stock flag, listing columns (ADR-0024 Q14) |
| `product.product_images` | Gallery images per product |
| `product.product_components` | Bill of materials: product → component product + quantity |
| `product.product_categories` | Category tree (slug, parent) |
| `product.product_settings` | Module settings (one row) |
| `product.code_numberings` | Per-module numbering series (ADR-0024 Q32) |

## HTTP surface

| Route | Guard | Notes |
|---|---|---|
| `/products` | `erp` | CRUD, filters, price ranges |
| `/product-categories` | `erp` | CRUD |
| `/product-listings` | `erp` | Website listing view over products |
| `/products/public/v1/catalog` | `none` (API key) | Public website catalog, the single external URL for this surface |
| `/products/code-numberings` | `erp` | Numbering series management |

## Cross-module contract

`ExportedProductService` (token `EXPORTED_PRODUCT_SERVICE_TOKEN`) is the only
way another module touches products: `resolve*` / `assert*` before writing a
logical product id (ADR-0014), plus read relays. It depends on this module's
repositories and on inventory's repository-only facade — never on another
module's *service*, which is how the product ↔ inventory cycle is broken
(ADR-0026).

## Dependencies and rules

- **Outbound:** no service-to-service calls; other modules consume the facade.
- **Inbound logical references:** `inventory.items`, `inventory.movements`,
  `sale.*` line tables, `procurement.*`, `project.*` carry nullable
  `product_id` columns (plain ids, no cross-schema FK).
- Prices are integer IDR minor units end to end (ADR-0002); documents snapshot
  the price at creation.
- Soft delete only (`deleted_at`); SKU uniqueness is a partial index over live
  rows, mapped to 409.

## Tests

`apps/backend/test/unit/**` product suites: SKU uniqueness (23505 → 409),
category integrity, price serialization invariance, listing filters, and the
facade's `assert`/`resolve` behaviour.
