# ADR-0026 — Product and warehouse become their own modules

- **Status**: Accepted (2026-11-23)
- **Supersedes**: the single-schema part of ADR-0008 ("the physical estate
  lives inside `inventory`"), ADR-0024 Q14 (product master inside inventory)
- **Superseded by**: none

## Context

Two very different things were living in one module and one Postgres schema.
`inventory` held the stock truth (units, ledger, balances, borrowings) *and*
two other worlds:

- the **product master** — `products` (with the website listing columns) and
  `product_categories`: reference data that sale, procurement, the public
  catalog and the assistant all read, and that changes rarely;
- the **physical estate** — `warehouses`, `warehouse_addresses`,
  `warehouse_storages`, `warehouse_managers`, `warehouse_organizations`,
  `warehouse_settings`: configuration data that other modules only *reference*.

That produced three problems:

1. **Dependency direction was wrong.** Sale and procurement had to inject the
   whole inventory module to look up a product name; nothing about listing a
   price needs the stock ledger.
2. **The two-schema exception was already history, not a principle.** ADR-0008
   argued warehouses belonged in `inventory` because both are "physical". In
   practice the warehouse tables are configuration with no stock logic, and
   `inventory` grew 28 tables with 37 intra-module FKs, which made the schema
   file the largest in the repo and hid the actual stock model.
3. **CODEOWNERS-style reasoning was impossible.** A change to `products`
   (catalog copy, slug, published flag) and a change to `stocks` (moving
   average, ledger) were the same module's concern, so review and release
   notes could not separate them.

## Decision

Create two modules, each with its own Postgres schema, folder, container,
module factory, numbering table and settings table:

| Module | Schema | Owns |
|---|---|---|
| `product` | `product` | `products`, `product_categories`, `settings`, `code_numberings` |
| `warehouse` | `warehouse` | `warehouses`, `warehouse_addresses`, `warehouse_storages`, `warehouse_managers`, `warehouse_organizations`, `warehouse_settings`, `settings`, `code_numberings` |

`inventory` keeps the stock truth: `item_serials`, `items`,
`item_categories`, `documents`, `movements`, `stocks`, adjustments, borrowing,
maintenance, condition checks, disposals, tool sets, `settings`,
`code_numberings` — 20 tables.

### Rules that follow

1. **One schema = one module, without exception.** The warehouse/product
   tables now live in their own schemas, so the "warehouse is part of
   inventory" carve-out documented in ADR-0008 is deleted from
   `module-ownership.md` and `validate-dbml.ts`.
2. **Cross-module ids are plain nullable columns (ADR-0014).** Every former FK
   from `inventory` into `product`/`warehouse` became a nullable uuid plus the
   standard logical-reference note:
   `item_serials.product_id`, `.warehouse_id`, `.bin_id`; `items.warehouse_id`,
   `.storage_id`; `movements.product_id`, `.warehouse_id`, `.bin_id`,
   `.target_warehouse_id`, `.target_bin_id`; `stocks.product_id`,
   `.warehouse_id`, `.bin_id`; `stock_adjustments.warehouse_id`;
   `stock_adjustment_items.product_id`, `.bin_id`. Presence is enforced by the
   writing service through the owning module's facade, not by the database.
3. **No module reads another module's tables.** All former joins and
   `EXISTS` subqueries were replaced:
   - `stock-valuation.repository` (joined products/warehouses/storages) →
     two batch facade calls (`productsById`, `warehousesById`) and a
     `searchByNameOrSku` id set;
   - `movement.repository` (subquery into `warehouses`) → `idsInScope`;
   - `product.repository` (`EXISTS` into `item_serials`/`stocks`, subquery
     sum, unit count) → `productIdsInWarehouse`, `availableByProducts`,
     `countSerials`;
   - `warehouse.repository` (`countKinds`, `countLiveUnits`) →
     `countSerialKindsByWarehouse`, `countMaterialStocks`,
     `countItemsByWarehouse`, `countLiveUnits` on the inventory facade, plus a
     local `countStorages`;
   - `checkStockAlert` and friends in sale/procurement keep using
     `StockService`, which is inventory's own contract.
4. **Each module has its own numbering series and format.** Migration of the
   code types is a data move, and the format gains the `{COMPANY}` token so a
   product/warehouse code identifies the issuing company like every other
   document code:

   | Code type | Owner | Before | After |
   |---|---|---|---|
   | `item_product` | product | `PRD-00001` | `PRD-<COMPANY>-00001` |
   | `item_material` | product | `MAT-00001` | `MAT-<COMPANY>-00001` |
   | `item_component` | product | `CMP-00001` | `CMP-<COMPANY>-00001` |
   | `warehouse` | warehouse | `WH-0001` | `WH-<COMPANY>-0001` |

   Issued codes are immutable and are **not** rewritten; only new rows use the
   new pattern. `product.code_numberings` and `warehouse.code_numberings` are
   new tables; `inventory.code_numberings.code_type` keeps only the remaining
   types.
5. **Each module has a `settings` table** (ADR-0024 Q27): `product.settings`
   and `warehouse.settings` for module-wide configuration, next to the
   per-warehouse `warehouse.warehouse_settings` that already existed.
   `inventory.settings` keeps the stock module's configuration.
6. **Serial units stay in inventory.** A unit's custody (where it is, who
   borrowed it, whether it was sold) is a stock fact, so `item_serials`,
   `items` and the status matrix moved to `inventory`:
   - `SerialUnitService` (`SERIAL_UNIT_SERVICE_TOKEN`) replaces the unit
     methods that used to sit on `ProductService`;
   - `assertTransitionAllowed`/`isStatusAllowedForKind` live in
     `inventory/constants/serial-matrix.ts`;
   - the routes stay `GET|POST /products/:id/units` and
     `PATCH /products/:id/units/:unitId` (a unit URL always names its
     product), served by `inventory/controllers/serial-unit.controller.ts`.
7. **HTTP prefixes follow the module.** Product endpoints moved out of
   `/inventory/...`:
   `/products`, `/product-categories`, `/product-listings`, and the
   server-to-server catalog at `/products/public/v1/catalog`.
   `/warehouses` and `/stock/*` and `/inventory/items` are unchanged.
8. **Migration is a regenerated baseline, not an incremental move.** There is
   no production database to preserve; `drizzle-kit` cannot express
   `ALTER TABLE … SET SCHEMA` reliably and the previous baseline
   (`20261120`) already established the "regenerate, then verify" precedent.
   The migration is regenerated, reviewed by hand (`SET SCHEMA`, the FK drops,
   the two new tables), applied to a disposable database, and the second
   `drizzle-kit generate` must report "no changes". This is the one accepted
   deviation from the append-only rule and it is recorded here.

## Cycle breaking

`inventory` needs product and warehouse (validate a reference before writing),
and product/warehouse need stock facts (availability, serial counts, open
borrowings). Service-to-service cycles are forbidden (tsyringe cannot build
them), so the rule pair is:

- `inventory → product` / `inventory → warehouse`: the owning module's
  **facade** (`ExportedProductService`, `ExportedWarehouseService`).
- `product → inventory` / `warehouse → inventory`: only
  **`ExportedInventoryService`**, a repository-only facade.

`ExportedProductService` uses `ExportedInventoryService` (for the unit count)
and `ExportedInventoryService` uses `ExportedProductService` (to label units
with their product kind). This is teardown-safe because both are plain
constructor calls over repositories with no state, and the composition root
registers `ExportedInventoryService` after the stock/movement/borrowing
repositories it composes.

## Consequences

- 20 schemas, 192 tables (188 before: +`product.settings`,
  `product.code_numberings`, `warehouse.settings`,
  `warehouse.code_numberings`; `inventory` drops 8 tables and gains none).
- `sale`, `procurement`, `automation` and the queue worker import product
  services from `@app/product` and warehouse services from `@app/warehouse`.
- The audit writer and the stored-image URL helper moved out of the modules
  (`src/shared/audit`, `src/shared/media`) because all three modules use them
  identically; keeping either inside one module would have made another import
  it.
- The web-admin, landing and portal callers switched to the new product URLs.
- `docs/database/module-ownership.md`, `logical-references.md`,
  `AGENTS.md` (18 → 20 schemas) and `validate-dbml.ts` were updated in the
  same change.

## Alternatives considered

- **Keep the tables in `inventory`, export more services** — rejected: the
  schema boundary is what makes ownership enforceable, and the split is
  cheap now, expensive later.
- **Move `item_serials` to `product` too** — rejected: a unit's warehouse,
  custody, sale and return are stock facts; `product` would then need the
  ledger, which is the cycle this ADR removes.
- **Incremental migration with `SET SCHEMA`** — rejected for now (no data to
  preserve, unsafe under drizzle-kit); revisit when a production database
  exists.
