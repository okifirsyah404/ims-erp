# ADR-0001 — Organization Model: One Company, Multiple Internal Organizations

- **Status:** accepted (business decision, 2026-10-25)
- **Context:** Better Auth `organization` plugin is installed and generates
  `auth.organizations` / `auth.members` / `auth.invitations`. Nothing in
  committed code demonstrated whether this means one company, several
  companies, or true multi-tenant separation. All inferences from team-switcher
  UI blobs are sample content, not semantics.
- **Decision:** The deployment serves **one company**. Better Auth
  organizations exist for *internal* structure (departments, teams, internal
  role/membership grouping, portal identity linking). ERP master data does not
  carry a tenant dimension; data isolation is the company deployment itself.
  Row-level ownership checks (customer-portal, investor-portal identities)
  provide per-record scoping where applicable.
- **Consequences:**
  - No `organization_id` tenant columns on ERP master tables for now.
  - Authorization role resolution uses Better Auth role/membership plus the
    ERP permission matrix; portal identities link to customer/investor rows.
  - **Migration path (recorded now, revisit before Phase 5):** adding true
    tenancy later = add nullable `organization_id` to master tables, backfill,
    make it not-null, then add repository-layer scoping predicates and
    composite indexes. Design decisions that assume single-company (cache key
    format, unique constraints) must be revisited then. This is deliberately
    *not* done speculatively.
- **Alternatives considered:**
  - Multi-company from day one (rejected: speculative geography for a single
    newly-established business; real FK/index/OO testing burden).
  - Membership-only without tenancy and without future path (rejected: keeps
    ambiguity — this ADR fixes the semantics and the exit hatch).
