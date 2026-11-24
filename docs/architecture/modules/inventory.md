# Inventory Module

Own schema: **`inventory`**, 21 tables. Tables, contracts and columns:
`docs.dbml` (canonical) and `docs/database/module-ownership.md` (profile 8).

> Rewritten 2026-11-24. Two earlier states are history only: the NestJS-era
> page, and the ADR-0024 arrangement where `inventory` also held the product
> master and the warehouse tables. **ADR-0026 (accepted 2026-11-23) split
> `product` and `warehouse` into their own modules and schemas** — see
> [product](product.md) and [warehouse](warehouse.md). `inventory` keeps the
> stock truth and the assets absorbed from the former `assets`/`catalog`
> schemas.

## Purpose and boundary

Track **physical things** through their whole life: received, stored, borrowed,
returned, maintained, lost, sold, or disposed. The module owns the item master
(physical units), the append-only stock ledger and its balance projection, and
the custody trail of anything lent out.

**In scope:** `items`, serial units, stock ledger + balances, adjustments,
borrowing (requests, custody, events), maintenance, condition checks,
disposals, tool sets, item categories, item documents/images.

**Out of scope:** the SKU/price master (`product`), the physical estate
(`warehouse`), purchase orders (`procurement`), valuation postings and COGS
(`finance` — the module keeps quantity; `stock/valuation` is a read surface).

## Tables (`inventory` schema)

| Table | Role |
|---|---|
| `items` | Physical item master; `kind` decides serialization. Product SKUs are `product.products` |
| `item_serials` | One row per physical unit (was `serial_tracked_items`); status and custody live here |
| `item_images` | Gallery; first live row is the cover |
| `item_categories` | Category with default depreciation rule (was `assets.*`) |
| `inventory_documents` | Attachment of a product or an item; exactly one owner column set |
| `movements` | **Authoritative** append-only ledger (stock + asset trail) |
| `stocks` | Service-maintained balance projection |
| `stock_adjustments` / `stock_adjustment_items` | Adjustment header + lines |
| `borrowing_requests` / `borrowing_request_events` | Request before issue + its timeline |
| `borrowings` / `borrowing_items` / `borrowing_events` | Custody header, one unit per line, business timeline |
| `maintenances` / `condition_checks` | Maintenance and physical checks |
| `disposals` | Write-off header |
| `tool_sets` / `tool_set_items` | Tools grouped as a set |
| `inventory_settings` | Module settings (one row) |
| `code_numberings` | Per-module numbering series (ADR-0024 Q32) |

## HTTP surface

| Route | Guard | Notes |
|---|---|---|
| `/inventory/items`, `/inventory/item-categories` | `erp` | Item master CRUD |
| `/inventory` (operations) | `erp` | Serial units, maintenance, condition checks, disposals, tool sets |
| `/inventory/borrowings`, `/inventory/borrowing-requests` | `erp` | Custody state machine |
| `/stock`, `/stock/adjustments`, `/stock/valuation` | `erp` | Ledger reads, adjustments, valuation read surface |
| `/products` (serial units) | `erp` | Serial units hang off a product SKU |
| `/inventory/code-numberings` | `erp` | Numbering series management |

## Invariants

1. **Status lives only on a serialized unit**, never on the item; vocabularies
   are the exported const arrays in `inventory.schema.ts`.
2. **`movements` is append-only** — no `updated_at`, no `deleted_at`; a
   reversal is a new row with status `reversed`.
3. **Custody beats location.** A borrowed or lost unit has no warehouse; the
   borrowing line snapshots where it left from (ADR-0009).
4. Cross-module ids (`product.products`, `warehouse.warehouses`,
   `warehouse.warehouse_storages`, `supplier.companies`, `customer.*`,
   `document.documents`, `auth.users`) are nullable plain columns validated
   through the owning module's contract (ADR-0014, ADR-0026).
5. `organization_id` is nullable on every table (`NULL` = company-wide), so
   coded tables carry the partial-unique pair (ADR-0008).

## Cross-module contract

`ExportedInventoryService` is the only entry point other modules use to create
stock movements or ask about stock/serial counts — in one transaction with
their own writes, never by inserting into `movements`. It also hosts the
repository-only facade `ExportedProductService` reads serial counts through,
which is how the product ↔ inventory cycle is broken (ADR-0026).

## Tests

`apps/backend/test/unit/**` inventory suites (item rules, transition matrix,
borrowing, adjustments, valuation) and
`test/authorization/inventory-authorization.test.ts` for guard boundaries. No
unit test opens a database connection — they run against
`test/helpers/mock-db.ts`; live-DB constraint proofs were one-shot scripts and
are not part of the suite.
