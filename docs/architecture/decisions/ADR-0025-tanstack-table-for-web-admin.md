# ADR-0025: TanStack Table drives every web-admin data table

Status: **accepted** (2026-11-21).

## Context

`apps/web-admin` renders 86 tables across 81 files. Each one hand-wrote
`<Table>` markup from `@ims-erp/ui`: repeated `<TableHead className='text-right'>`
headers, per-cell `font-mono` strings, and three different wrapper containers
(`Card` + `p-0`, `rounded-md border`, `rounded-lg border`). Nothing tied a
column's header to its cells, so alignment drifted per file, and adding a shared
behaviour (sorting, row selection, column visibility) would have meant touching
all 81 files again.

Lists here are paginated, filtered and sorted **server-side** (`page`, `limit`,
`search`, `status` query params plus `PaginationControls`). The table layer is
therefore a renderer, not a data engine.

The shadcn Data Table page is a guide, not a component: it pairs the
`@ims-erp/ui` `Table` markup with TanStack Table v9.

## Decision

1. Add `@tanstack/react-table` (v9, `^9.3.1`) to `apps/web-admin` and route every
   data table through one `components/data-table/data-table.tsx`.
2. Register one shared feature object (`data-table-features.ts`) with the v9
   `tableFeatures()` helper: core plus filtering, sorting, visibility,
   pagination and selection. Features absent from that object are tree-shaken,
   so it stays the single place to opt into new behaviour.
3. Column presentation lives in `columnDef.meta` (`align`, `cellClassName`,
   `headClassName`), declared through v9's `columnMeta` slot. Alignment is
   applied to header and cells from one source, so they cannot drift apart.
4. Columns are defined with `useMemo` inside the component because headers are
   translated with `t()`.
5. Server-driven lists keep `manualPagination` semantics: `DataTable` receives
   the current page rows and never paginates them itself.
6. Tables that need custom `colSpan` rows or `TableFooter` totals keep the raw
   `Table*` primitives, still inside the same frame, instead of forcing them
   through a column model that cannot express them.
7. Print documents (`*-document.tsx`) stay native HTML tables: they are
   page-layout artifacts (mm units, break rules, hard-coded brand colours), not
   app data grids.
8. `empty` / loading states render inside the table body (`h-24 text-center`,
   per the guide) rather than replacing the table, so the header stays visible.

## Consequences

- One place to change table styling, alignment and empty behaviour.
- Adding sorting, row selection or column visibility to a list is a column-level
  change rather than a rewrite.
- A new dependency in `apps/web-admin`; it is tree-shaken by feature set, but
  still grows the bundle.
- Column definitions are more verbose than JSX rows; `meta` keeps them close to
  the old intent.
- Regression risk is visual: there were no table tests. `test/data-table.test.tsx`
  now covers rows, alignment, empty and bordered behaviour.
