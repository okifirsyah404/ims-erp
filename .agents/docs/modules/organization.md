> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# Organization Module

## Purpose and boundary

Internal structure of the single business entity (ADR-0001): company profile,
internal departments/teams via the Better Auth `organization` plugin, and
membership management. **Not** a tenant dimension — no `organization_id`
columns on master data for now (migration path recorded in ADR-0001).

## Current state (audit, 2026-10-25)

**Scaffold only.**

- `modules/organization/{controllers,services}/*.ts` ++
  `organization.module.ts` registered in `app.module.ts`; controller/service
  empty; 2 pre-written unit specs exist.
- Better Auth `organization` plugin configured (tables `organizations`,
  `members`, `invitations` exist in the baseline migration with FK/unique
  constraints).

## Data ownership

- Company profile (legal/display name, addresses, tax identity, logo, bank
  references) — planned either here or in a settings owner; decide in Phase 3
  (commercial T03 territory; do not duplicate tables).
- Auth organizations/members/invitations — Better Auth-owned; this module
  orchestrates them via `auth` client APIs/contracts, not by hand-editing
  tables.

## Behavior targets (commercial scope: T02/T03; M01/M12 stage-1 "internal roles")

- Company profile CRUD (restricted to elevated roles).
- Teams/departments and membership assignments feeding role resolution
  (authorization module).
- Team switcher UI uses real organization data (currently sample "Acme Inc"
  data in `main-sidebar.tsx`).

## Dependencies and rules

- Uses Better Auth server APIs for org operations for consistency (single
  session/membership source).
- No tenant scoping in queries (ADR-0001) — if true tenancy ever lands, all
  scope-predicates change together (migration path in the ADR).

## Tests

- Existing 2 pre-written specs (scaffold) — extend when implementing.
- Required: permission-denial tests; membership changes reflect in
  authorization (role resolution) on next request (no stale-cache privilege
  escalations).
