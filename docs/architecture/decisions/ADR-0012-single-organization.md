# ADR-0012 — One Company, One Organization

- **Status:** superseded (2026-11-08) by ADR-0012
  (`ADR-0012-multi-organization.md`), which restores ADR-0007 §1: multiple
  internal organizations are allowed. Its creation/restore 409 gate
  (`SingleOrganizationError`, `organization.singleCompany`) has been removed;
  the seeder still seeds only the first organization.
- **Context:** ADR-0007 allowed several internal organizations (departments)
  inside the one company, and ADR-0010 linked warehouses to them. The owner
  confirmed the business is one company without separate departments, and
  ADR-0011 already made all business data company-wide. Removing Better
  Auth organizations altogether is not an option: in this codebase an
  organization is the container of the role system — `auth.roles` are per
  organization, the `erp` guard resolves permissions through the active
  organization, and memberships carry the roles.
- **Decision:**
  1. The deployment has **exactly one live organization** — the company.
     `OrganizationService.createOrganization` and `restoreOrganization`
     answer **409** (`organization.singleCompany`) when a live organization
     already exists.
  2. The organization is **seeded in every environment** (production
     included), as "Entragate" with the initial admin as owner; the seeder
     does nothing when any live organization exists, whatever its slug.
  3. Development-only seed data stays out of production explicitly: the
     role accounts (guessable `<role>123456` passwords), the inventory sample
     data (faker) and the dev company profile check `isProductionEnv()`
     themselves instead of relying on a missing organization.
  4. The web admin hides "new organization" (organizations page and the
     sidebar switcher) once a live organization exists. Members and roles
     pages stay: they are where the owner manages who may do what.
- **Consequences:**
  - ADR-0007 §1 (several organizations) is superseded; its other points
    (application-admin bootstrap, owner = creator, per-organization role
    catalog) still hold for the single organization.
  - ADR-0010's warehouse–organization links have nothing to choose between;
    every warehouse belongs to the one company. ERP-0031 should be revisited
    by programmer A (likely reduced to "all warehouses usable").
  - Nothing in the business data changes: it is already company-wide
    (ADR-0011 §2).
- **Alternatives considered:**
  - **Remove organizations entirely** — rejected: it means rebuilding the
    role system and the `erp` guard outside Better Auth's organization
    plugin.
  - **Keep several organizations as departments** — rejected by the owner:
    the business has no departments that need separate roles.
