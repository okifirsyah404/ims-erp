# ADR-0009 — Serialized Units and Borrowing Custody

- **Status:** accepted (2026-11-02). Depends on ADR-0008.
- **Context:** The requirement is to *track items* — not just quantities —
  through their whole life: pre-ordered, received, borrowed, returned, lost,
  sold, or consumed as a warranty replacement. That needs three things the
  existing catalogue could not express:
  1. a SKU master that knows whether its instances are individually
     identifiable;
  2. a row per physical instance, carrying its own status and location;
  3. a custody trail answering *who has it, and where, right now* — including
     for borrowers who are not registered users.
- **Decision:**
  1. **Two levels: `items` (SKU master) and `serial_tracked_items` (units).**
     `items.is_serialized` decides whether units exist. **Status only exists on
     a unit** — a non-serialized item has no status, because a quantity does not
     have one.
  2. **The table keeps the name `serial_tracked_items`.** It is *not* renamed to
     `item_units`: 33 logical references across the DBML document already use
     the existing name, and a rename would churn the contract for no gain.
  3. **Consumption matrix.** `product`, `component`, and `material` may be
     sold, applied to warranty, borrowed, or tested. `tool` may **only** be
     borrowed. `service` is never stocked and never serialized. The matrix is a
     service rule (`assertTransitionAllowed`) plus a schema CHECK for the
     kind-independent parts, because the kind lives on the parent row.
  4. **Custody moves off the warehouse row.** `serial_tracked_items.warehouse_id`
     is **NULL** while a unit is borrowed or lost — the borrower holds it, not a
     warehouse. Each borrowing line therefore snapshots
     `origin_warehouse_id`, because the unit itself no longer names one and the
     loss flow must know which warehouse to reduce.
  5. **Borrowing writes the stock ledger.** Movement types gain
     `borrowing_out` / `borrowing_in`, and a schema CHECK forces
     `reference_type = 'borrowing'` for them, so a borrowing movement can never
     be posted by hand.
  6. **Borrowing is serialized-only.** A line always names one specific unit;
     there is no "quantity borrowed". Quantity borrowing would be
     untraceable, which defeats the requirement.
  7. **Request and issue are separate.** `borrowing` is its own permission
     statement with `read / create / update / approve / issue / return /
     extend / mark_late / mark_lost / export`. A technician may request but not
     issue. `mark_lost` is restricted to `owner`, `admin`, and
     `operations_manager`, because writing off an asset is a management act.
  8. **Approval is skippable.** The state machine is
     `draft → requested → approved → issued → partially_returned → returned →
     closed`, with `rejected` and `cancelled` as terminal escapes. A deployment
     that does not want approval may go `requested → issued` directly.
  9. **Guest borrowers are snapshotted on the header.** `borrower_type ∈ {user,
     customer, guest}`; guest identity (`guest_name`, `guest_phone`,
     `guest_id_type`, `guest_id_number`, `guest_address_text`,
     `guest_id_document_ref`) is copied onto `borrowings` because there is no
     row to point at. A CHECK forces exactly one identity path to be populated,
     so a "user" borrowing cannot smuggle a guest name.
  10. **"Testing" is a borrowing, not its own flow.** It is
      `purpose = 'testing'` on the same issue/return engine — one engine, one
      discriminator.
  11. **A pre-ordered unit gets a provisional serial (`PO-…`), replaced exactly
      once.** The replacement guard is part of the `UPDATE` predicate
      (`is_provisional_serial = true AND status = 'pre_order'`), so a
      concurrent second call matches no row instead of overwriting. The
      provisional serial is the seam where a future supplier/procurement
      module will attach a real purchase-order line
      (`purchase_order_line_id`, currently an unvalidated logical reference).
  12. **The event trail is append-only and physical events must carry their
      movement.** `borrowing_events.stock_movement_id` is a nullable logical
      reference; a CHECK requires it for `issued`, `returned`, and
      `marked_lost`, and forbids it for every other event type. Movements never
      point back — one direction only.
  13. **Late return is both derived and recorded.** A line is late when
      `due_at` has passed and `returned_at` / `marked_lost_at` are null; a
      scheduled sweep additionally writes a `marked_late` event so the
      business timeline shows it without recomputation.

- **Consequences:**
  - The FK cycle between `serial_tracked_items.current_borrowing_line_id` and
    `borrowing_lines` cannot be declared in the initial migration; the column
    arrives in a later `ALTER TABLE`.
  - Guest PII (`guest_id_number`, `guest_id_document_ref`,
    `guest_address_text`) is access-restricted and expired by a retention
    sweep — 24 months is the working default (OPEN-2 in the plan).
  - Valuation is out of scope for this slice: `stock_balances.average_cost` and
    `total_value` exist but are never advanced (OPEN-3).
  - An item with live units cannot be archived; the check is optimistic rather
    than transactional, so a unit created concurrently with an archive is
    caught by the `restrict` FK instead.

- **Accepted risk:** `serial_tracked_items` has no variant dimension, so a
  serialized item sold in several variants (colour, capacity) needs one `items`
  row per variant. That is the OPEN-1 follow-up: `item_variants` will be needed
  before serialized units are usable at volume.

- **Alternatives considered:**
  - **A single `stock_items` table with a nullable serial column, quantity
    otherwise** — rejected: it collapses two different identities into one row
    shape and leaves status meaningless for the non-serialized half.
  - **Borrowing as an `asset` module concern** — rejected: assets are
    company-owned fixed assets; borrowed inventory is a custody event, and
    putting it in `asset` would split the stock ledger.
  - **A separate `test_borrowings` table for the testing purpose** — rejected:
    it duplicates the issue/return engine and the event trail for one
    discriminator value.
  - **Storing guest identity in a reusable `parties` table** — rejected for
    now: it needs a CRM-side identity model this slice does not own, and guest
    data must expire independently of any real party record.
