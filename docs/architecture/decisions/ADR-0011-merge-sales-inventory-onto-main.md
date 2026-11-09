# ADR-0011 — Merging the M02/M05/M07 Branch onto Main: One Item Master, One Ledger

- **Status:** accepted (2026-11-05, after discussion between programmer A
  (Oki, owner of the platform and inventory core), programmer B's module
  owner, and the owner; reported by programmer B's module owner). Depends on
  ADR-0007, ADR-0008, ADR-0009 and ADR-0010 (many warehouses, agreed in the
  same discussion).
- **Context:** Two lines of work grew in parallel from commit `c254919`:
  - `main` (programmer A): internal organizations as departments (ADR-0007),
    per-organization dynamic roles (`auth.roles`), user management, audit
    log, i18n (`packages/locales`), and the inventory core: `inventory.items`,
    multiple warehouses with storages, the append-only stock ledger,
    serialized units with a status lifecycle, borrowing, transfers and
    adjustments (ADR-0008/0009/0010).
  - `feat/m05-inventory-purchasing` (programmer B): M02 CRM and sales
    (customers, leads, SPH with revisions and deal/lost outcome, sales
    orders, invoices from the SPH payment plan, receipts, document
    numbering, company profile, website public API), M05 purchasing and
    stock flows (suppliers, PO with approval, goods receipt, average cost,
    delivery notes, opening stock, inventory value) and M07 (projects, BAST,
    warranty certificates, service tickets). Its own decision records were
    kept in `.agents/docs/decisions/` as ADR-0007…0010 (different content
    from main's numbers; they are renumbered or summarized when ported).

  A trial merge (2026-11-05) gave 49 conflicting files and, worse, two
  designs for the same tables: both branches create `inventory.warehouses`,
  `stock_movements`, `stock_balances` and `stock_adjustments` with different
  columns, keep two item masters (`inventory.items` vs `product.products`)
  and two serial tables, and carry two migration chains that branch from
  `20261029044823_dear_living_lightning`. A textual merge cannot produce a
  working database.

- **Decision:**
  1. **Main is the base.** Programmer B ports M02/M05/M07 onto main on a
     branch (`merge/main-sync`); nothing is merged into main without review
     by programmer A.
  2. **One company.** Business data (customers, leads, SPH, sales orders,
     invoices, receipts, projects, tickets, suppliers, POs) is company-wide,
     with no `organization_id` tenant column, as ADR-0007 §2 already says for
     master data. Organizations stay internal departments: they decide roles,
     not which customers or SPHs exist. Record visibility (own vs all) stays
     a role and ownership rule in the services.
  3. **One item master: `inventory.items`.** `product.products` is not
     ported. `inventory.items` gains the columns the sales chain and the
     website need: `brand`, `specification`, `status` (`active` /
     `inactive`), `created_by`; a category reference to an inventory-owned
     category table (replacing the free-text `category`); and a **fixed unit
     list** (`pcs`, `unit`, `set`, … — the existing list from programmer B)
     replacing the free-text `unit_label`. Item images and website catalog
     fields (slug, published flag, summary, applications, availability,
     show-price) live in side tables owned by the module that uses them, so
     the item row stays small. Item kinds stay as ADR-0009 defines them
     (`product`, `component`, `material`, `tool`, `service`).
  4. **One serial model: `inventory.serial_tracked_items`.** Programmer B's
     `serial_numbers` table is not ported. The sales flows drive the existing
     unit statuses: a goods receipt makes a unit `in_stock` (replacing a
     provisional `PO-…` serial when one exists, ADR-0009 §11); a shipped
     delivery note makes it `sold`; a warranty replacement uses
     `applied_warranty`.
  5. **One stock ledger: `inventory.stock_movements` / `stock_balances`,**
     posted only through the inventory stock service contract. Programmer B
     extends it, under programmer A's review, with **moving-average cost**:
     `unit_cost` on movements and `average_cost` / `total_value` on
     balances, all integer IDR minor units (ADR-0002) with half-up rounding;
     quantities stay `numeric(18,3)` as main defines them. Goods receipts,
     delivery notes and opening stock post `receipt`, `issue` and
     `adjustment_in` movements with their document as the reference.
  6. **Adjustments use main's `stock_adjustments`** and its approval states;
     programmer B adds the opening-stock use (with unit cost) and the
     "creator cannot approve" rule instead of keeping a second table.
  7. **Many warehouses.** The owner asked for several warehouses, so
     ADR-0010 should be accepted and the v5.1 M05 baseline ("one warehouse",
     "no transfers") revised through change control. Every purchasing and
     delivery document names its warehouse (storage optional).
  8. **Borrowing belongs to M06** (assets and equipment) and stays with
     programmer A.
  9. **Dynamic roles.** Programmer B's static role grants are not ported as
     code; the permissions they need (e.g. `project:read_cost`, finance
     reading deal SPHs and sales orders, technician ticket rights) are added
     to the per-organization role catalog seeded by
     `seedRolesForOrganization`, and statements missing from the shared
     catalog are added to `packages/common`.
  10. **IDs.** New business tables use `uuid` primary keys with
      `uuidv7()` defaults, like the inventory tables. Better Auth tables keep
      their text IDs.
  11. **Migrations are rebuilt, not merged.** There is no production
      database yet, so programmer B's 19 migrations are not carried over.
      The ported schema is generated as new, append-only migrations on top of
      main's chain, inspected, and applied to a disposable database. Dev
      databases are recreated.
  12. **Module names follow main.** Purchasing is the `procurement` module
      (backlog ERP-0035, now owned by programmer B); payable handoff to M09
      stays a later contract. Documentation moves to `docs/architecture/` and
      `docs/plan/`; UI copy goes through `packages/locales` (Indonesian and
      English keys) instead of hard-coded strings.
  13. **Ownership.** Programmer A owns the platform (organizations, roles,
      users, audit) and the inventory core (items, warehouses, storages,
      links, ledger, serial units, transfers, borrowing). Programmer B owns
      M02, procurement, delivery notes, the stock valuation logic, the item
      side tables, and M07. The owner of a table approves every change to it.

- **Porting order** (each step green on backend tests and the browser e2e
  suite before the next): numbering + company profile + role catalog entries
  → item extensions (categories, units, images, website profile) → M02 →
  procurement (suppliers, PO, receipts) + average cost → delivery notes,
  adjustments/opening stock, inventory value → M07. Then one pull request to
  main.

- **Consequences:**
  - Programmer B rewrites schemas, repositories and migrations of M02/M05/
    M07; business rules, services, UI and tests are reused.
  - Programmer A reviews changes to `inventory.items` and the stock service
    (cost columns, new movement references).
  - Until the port is merged, neither side makes large changes to the
    inventory core tables without telling the other; programmer B starts no
    new features on the old branch.
  - Decision records of the old branch (SPH outcome and billing from the
    payment plan, cross-domain transactions, M07 projects and after-sales)
    are carried into `docs/architecture/decisions/` with new numbers.

- **Change-control items for the owner:** many warehouses and stock
  transfers in M05 (revises v5.1 "one warehouse"); automatic moving-average
  HPP for the inventory value (v5.1 says HPP is a manual finance summary —
  the computed value is shown as a report figure, the journal still needs
  finance approval).

- **Alternatives considered:**
  - **Merge main into the old branch and resolve conflicts file by file** —
    rejected: it keeps two item masters, two serial tables and two migration
    chains; the result would not migrate.
  - **Keep programmer B's inventory and port programmer A's work onto it** —
    rejected: main is the shared trunk and already holds the platform pieces
    every module needs; moving them would stall programmer A.
  - **Organization-scoped business data (`organization_id` on customers,
    SPHs, invoices)** — rejected: with departments as organizations it would
    hide one department's customers from another inside the same company.
