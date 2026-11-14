# ADR-0013 — One Numbering Authority

> **Renamed 2026-11-13 (ERP-0042).** The numbering authority moved out of
> `organization` into its own module and Postgres schema: the table is now
> `code_number.series` (verbatim rename, `document_type` → `code_type`) and the
> service is `CodeNumberService.next(codeType, { date, context, tx })`, token
> `CODE_NUMBER_SERVICE_TOKEN`. The decision below is unchanged; only the names
> and the owning module moved.

- **Status:** accepted by the module owner (2026-11-06, while resolving the
  conflicts of PR #58: "Satukan ke punya kita"). Programmer A (Oki) to
  acknowledge in that PR, because it replaces his ERP-0009
  `DocumentNumberingService`.
- **Context:** Both branches implemented ERP-0009 with the same table name,
  `organization.document_sequences`, in incompatible shapes. Main's version
  is a per-organization counter (`organization_id`, `doc_type`, `prefix`)
  used by stock movements (MV), adjustments (ADJ), asset documents (AST,
  MNT, DSP, TST) and borrowings (BRW); each service formatted its own code.
  The ported branch has a company-wide series per document type (ADR-0011,
  ADR-0012) with owner-editable patterns, reset policies and a settings
  page, used by every sales, procurement, project, after-sales and
  licensing document. Applying both migration chains failed on the second
  `CREATE TABLE`, and two services would have numbered documents two ways.
- **Decision:**
  1. `NumberingService.next(type, { tx })` is the only way to number a
     document. `DocumentNumberingService` and its token are removed; the
     inventory and asset services call `next` inside their own
     transactions, as before.
  2. Main's document families become document types with default patterns
     that keep their old shape: `stock_movement` `MV-YYYYMM-######`
     (never resets), `asset` `AST-######`, `asset_maintenance`
     `MNT-YYYY-#####`, `asset_disposal` `DSP-YYYY-#####`, `asset_tool_set`
     `TST-#####`, `asset_borrowing` `BRW-YYYYMM-####` (monthly);
     `stock_adjustment` uses the default company pattern. The owner can
     change them on the numbering settings page.
  3. Migrations: main's history stays untouched. The ported migrations,
     which had never reached main, start after main's last one (folders
     renamed to `20261106110000…`, the first snapshot's parent set to
     main's leaf) and no longer create the table. The new migration
     `20261106165521_merge_main_reconcile` reshapes main's table: it
     collapses rows of the same type to the highest counter, fills the
     module and the current period, and keeps every counter running, so no
     code is issued twice.
- **Consequences:**
  - Codes are company-wide (no per-organization counters), consistent with
    ADR-0012.
  - Development databases that applied the ported migrations under their
    old folder names must be rebuilt (`ims_erp_sync` was rebuilt on
    2026-11-06). Databases at main's state upgrade in place; verified on a
    disposable copy with counters (`stock_movement` continued from 43).
  - Test doubles implement `next` with the real default patterns.
