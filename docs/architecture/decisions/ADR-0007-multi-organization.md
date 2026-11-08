# ADR-0007 — Multi-Organization Inside One Company

- **Status:** accepted (2026-11-02). Supersedes the single-organization
  reading of ADR-0001. §2 (no `organization_id` on master tables) is amended
  for the `inventory` module by **ADR-0008**. Transaction documents that
  record the issuing organization are covered by **ADR-0012**; the
  `organization_id` reference itself is nullable per **ADR-0014**.
- **Context:** ADR-0001 decided this deployment serves **one company** and that
  Better Auth organizations model *internal* structure. The implemented code
  then went further and enforced a literal single-organization invariant
  (`OrganizationService.createOrganization` threw `OrganizationAlreadyExistsError`
  → HTTP 422 once any row existed, soft-deleted included). That is stricter
  than ADR-0001 asked for, and it blocked a legitimate requirement: running
  several internal organizations (e.g. a Jakarta HQ and a Bali branch) inside
  the one company, each with its own membership and role administration.

- **Decision:**
  1. **Multiple organizations are allowed inside the single company.** The
     single-organization invariant and its 422 are removed.
  2. **Master data stays company-wide.** This is NOT multi-tenancy: no
     `organization_id` tenant columns on ERP master tables. ADR-0001's
     migration path (nullable column → backfill → NOT NULL → repository
     scoping predicates → composite indexes) remains deliberately unbuilt.
  3. **Only application administrators create organizations.** The gate is the
     Better Auth global role `user.role === 'admin'` (`GLOBAL_ADMIN_ROLE`), not
     an organization permission, and it is **independent of membership**: an
     application admin who belongs to no organization must be able to
     bootstrap the first one. Enforced twice — the HTTP policy in
     `OrganizationBootstrapController` and Better Auth's
     `allowUserToCreateOrganization` plugin option.
  4. **The creator becomes the organization's `owner`** and Better Auth
     activates the new organization for that session
     (`createOrganization` sets the active organization whenever it is called
     with session headers).
  5. **Every created organization gets the full per-organization role
     catalog** (`auth.roles`), seeded by the shared `seedRolesForOrganization`
     helper. Role *permissions* remain per-organization data and stay
     editable by that organization's owner.
  6. **The last live organization cannot be deleted** (409). Deleting an
     organization is a soft delete, so Better Auth's own cleanup never runs;
     the service therefore unsets the caller's `activeOrganizationId`, and
     other members are released on their next session creation.
  7. **The organization seeder is dev-only** (`prod`/`production` skip it). In
     production the first organization is created through the API by an
     application admin. The skip is a no-op, never a throw, so the remaining
     seeders still run.

- **Consequences:**
  - `apps/backend/src/authorization/elysia-auth.ts` `sessionGuard` gained an
    optional `policy` hook, and `POST /organizations` moved off `erpGuard`
    onto `sessionGuard` — the only organization route that works **without**
    an organization context.
  - The sidebar organization switcher lists **all live organizations** for
    application admins (first-party `/organizations` endpoint) and only the
    caller's memberships for everyone else (Better Auth
    `organization.list`). Better Auth's list is membership-scoped and cannot
    serve the admin view.
  - `useActiveOrganizationId()` has **no** "first organization" fallback: with
    several organizations that silently reads another organization's data. It
    returns `null` and callers render a placeholder.
  - Organization creation is best-effort on role provisioning; a failure logs
    and leaves the permission resolver on its static-catalog fallback rather
    than orphaning a created organization.

- **Accepted risk:** application admin is held via the Better Auth `admin()`
  plugin, and admins can promote other users — so the organization-creation
  right is self-escalating. This is accepted because the application-admin
  role *is* the company owner identity in this product. ADR-0006's rule that
  `admin()` grants no ERP permissions is unchanged: being an application admin
  still confers no organization-scoped data access.

- **Alternatives considered:**
  - **True multi-tenancy (per-customer organizations)** — rejected: the
    business sells to customers inside one company; isolation would require
    the full ADR-0001 backfill and rewrite every repository.
  - **Any organization member may create organizations** — rejected: it makes
    every member a company-owner-equivalent, since creation grants `owner` of
    the new organization.
  - **Keep `erpGuard` and require the creator to already hold
    `organization:create` in some organization** — rejected: a membershipless
    application admin could never bootstrap the first organization, and only
    the `owner` grant holds that permission.
