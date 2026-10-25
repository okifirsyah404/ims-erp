# Assets & Projects Module (owner to be created)

## Purpose and boundary

Two related registers, one owner to be assessed (extend inventory or a new
domain — decide at Phase 5 start, task ERP-0015):

- **Assets/equipment** (v5.1 M06): asset value register, person in charge
  (PIC), condition, borrowing/return, service notes. Depreciation is
  recorded as **finance journal entries — no automatic depreciation**, no
  barcode, no service scheduling (contractual limits).
- **Projects & after-sales** (v5.1 M07): PIC, targets, tasks/status, direct
  costs, testing/training/BAST evidence, tickets/warranty with manual
  closure confirmation. Customer portal later displays project/BAST status
  and the customer's own tickets (T26). Limits: no technician scheduling, no
  automatic SLA, no automatic material allocation.

## Current state (audit, 2026-10-25)

**Absent — no module directory.** No related tables beyond none (assets have
no schema yet).

## Planned ownership (Phase 5)

- `erp.assets` — code, category, serial, acquisition date/value (minor
  units), location, responsible person (employee ref), condition, status.
  Borrowing/return + service notes as event tables (immutable, reversible).
- `erp.projects` — customer ref, PIC, target/status, direct costs (refs to
  expenses/purchases), evidence attachments (testing/training/BAST).
- `erp.tickets` — customer ref, warranty flag, task/cost links, closure
  confirmation (manual), portal visibility scoping.

## Behavior targets

- Asset register + loan/return/service flows (S07); depreciation entries
  entered by finance against asset values (reconciliation checked by finance).
- Projects: plan/PIC → tasks/evidence → testing/training → BAST (S08);
  after-sales ticket lifecycle (S09: internal/portal ticket → warranty check
  → task/cost → confirmation → close).

## Dependencies and rules

- Consumes employee (PIC), customer (project/ticket owner), inventory
  (materials if referenced), finance (cost posting, depreciation entries).
  Portal scoping: customers see only own projects/tickets (server-side).

## Tests

- None exist. Required: BAST evidence completeness gate, ticket closure
  confirmation rule, asset loan/return state integrity, portal scoping
  tests (customer A × customer B).
