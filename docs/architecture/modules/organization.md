> **Deprecated (ADR-0024, 2026-11-20).** This page describes the pre-refactor module "organization". It is kept for history. Current owner: auth (schema `auth`: organizations, members, invitations, organization_settings) - see docs/database/module-ownership.md.
> Mapping: organization schema removed -> auth; HTTP /organizations stays in apps/backend/src/app/organization.

# Organization Module

> Updated 2026-11-02. Reflects the Elysia backend (`apps/backend`) and
> web-admin implementation. Supersedes the historical NestJS audit below the
> divider at the end of this file.

## Purpose and boundary

Internal organizations of one company (ADR-0001, extended by ADR-0007)
modeled through Better Auth's `organization` plugin: the organization row, its
membership, and member role administration. **Not** a tenant dimension - no
`organization_id` columns on master data (migration path recorded in
ADR-0001, deliberately unbuilt). Invitations are out of scope for v1 (direct
member add only); company profile/address data belongs to a future settings
owner, not here.

> **Scope shrank 2026-11-13 (ERP-0042).** The company profile, the invoice bank
> accounts and the numbering series no longer live here. They moved to three
> sibling modules with their own Postgres schemas: `src/app/company`
> (`company.*`), `src/app/code-number` (`code_number.series`) and
> `src/app/document` (`document.*`). This module now owns only the organization
> row, its members, roles, and `organization.settings`.

## Multiple organizations

Several organizations may exist inside the single company (ADR-0007). The
former single-organization invariant is gone; there is no 422 on create.

- **Who creates**: application administrators only —
  `user.role === 'admin'` (`GLOBAL_ADMIN_ROLE`), independent of organization
  membership so the first organization can be bootstrapped. Enforced twice:
  the `OrganizationBootstrapController` policy and Better Auth's
  `allowUserToCreateOrganization` plugin option.
- **Ownership**: the creator becomes `owner`, and Better Auth activates the
  new organization for that session.
- **Role catalog**: roles are a closed enum (`erpRoleNames` in
  `@ims-erp/common`), so a created organization needs no per-organization role
  rows. The creator becomes `owner`; further role changes go through
  `auth.members.role`.
- **Last organization**: deleting the final live organization responds
  **409** (`LastOrganizationError`). Delete is a soft delete, so the service
  also unsets the caller's `activeOrganizationId`; other members are released
  on their next session creation.
- **Seeding**: the organization seeder is dev-only (`prod`/`production` skip
  it) and keyed by slug, so extra organizations can be seeded with
  `ensureOrganization`; `addSeedMembersTo` joins the seeded accounts to any
  organization.

## Session auto-activation

`sessionAutoActivateOrganizationHook`
(`src/providers/better-auth/options/session.auth.ts`, wired as
`databaseHooks.session.create.before` in `auth.options.ts`) stamps the
user's first `members` row (by oldest `createdAt`) as
`activeOrganizationId` when a **new** session is created. Effect: after
login, every `erpGuard` route resolves an organization context with no
`x-organization-id` header needed; users without membership keep `null`
and correctly get 403 from org routes.

This is a convenience default, not an authorization decision: with several
organizations the active one is the server-side session fact written by
`organization.setActive`.

Caveat: the value is stamped at session creation — sessions created
before this hook existed keep their stored value and need one re-login
(or one manual switch via the org switcher).

## Backend (`apps/backend/src/app/organization/`)

Standard module layout: `contracts/` (zod + interfaces), `repositories/`,
`services/`, `errors/`, `adapters/`, `controllers/`, `constants/`,
`container.ts` (there is **no** `routes/` or `containers/` directory).

- **Repository** — Drizzle over Better Auth–owned `auth.organizations` /
  `auth.members`. Write surface limited to `deletedAt` (soft delete/restore);
  membership and profile mutations go through the Better Auth gateway.
  `countActive()` backs the last-organization guard.
- **Adapter** (`adapters/better-auth-organization.ts`) — wraps `auth.api`:
  `createOrganization` (headers forwarded when session-scoped, `userId`
  for server-side/system creates), `setActive` (set or clear the session's
  active organization), `updateOrganization`, `getFullOrganization`,
  `addMember`, `updateMemberRole`, `removeMember`. Caller headers forwarded
  where Better Auth runs its own authorization. Organization DELETE
  intentionally does NOT use `auth.api.deleteOrganization` (hard delete) —
  service routes it to the repository's `softDelete`.
- **Service** — organization creation with role provisioning, last
  organization guard, soft-delete/restore, last-owner protection
  (`countOwners` before role change/removal), member listing with user join.
- **Controllers** (`routes/organization.controller.ts`) — two plugins:
  - `OrganizationController.plugin()` — every organization-scoped route,
    behind `erpGuard` with `organization:*` / `member:*` requirements.
  - `OrganizationBootstrapController.plugin()` — `POST /organizations` only,
    behind `sessionGuard` + application-admin policy, so it works with no
    organization context.

### Routes

| Method | Path | Guard / Permission | Notes |
|---|---|---|---|
| POST | `/organizations` | `sessionGuard` + app admin | creator becomes owner |
| GET | `/organizations` | `organization:read` | paginated; `includeDeleted=true` |
| GET | `/organizations/:organizationId` | `organization:read` | |
| PATCH | `/organizations/:organizationId` | `organization:update` | name/logo/metadata |
| DELETE | `/organizations/:organizationId` | `organization:delete` | soft delete; 409 when last |
| POST | `/organizations/:organizationId/restore` | `organization:delete` | clears deletedAt |
| GET | `/organizations/:organizationId/members` | `member:read` | paginated, joined users |
| POST | `/organizations/:organizationId/members` | `member:create` | direct add by userId |
| PATCH | `/organizations/:organizationId/members/:memberId` | `member:update` | role change; 409 last owner |
| DELETE | `/organizations/:organizationId/members/:memberId` | `member:delete` | 409 last owner |

Domain errors map to 403/404/409 envelopes (see
`errors/organization.errors.ts`).

## Soft delete

`deletedAt` timestamp on `auth.organizations`:

- Plugin option: `schema.organization.additionalFields.deletedAt`
  (`type: 'date'`, `required: false`, `input: false`) in
  `src/providers/better-auth/plugins/organization.auth.ts`.
- Drizzle column: hand-maintained in `drizzle/schemas/auth.schema.ts` —
  **never run `auth:generate`** (cli 1.4.x regresses pgSchema/plural tables).
- A soft-deleted organization fails `erpGuard` membership resolution → 403
  (correct: deleted org = no ERP access until restore).

## Permissions vocabulary extension

`builtInOrgStatements` in `@ims-erp/common` extends Better Auth's defaults
with `organization.create|read` and `member.read` so first-party admin
routes can require list/show permissions. `organization-ac.ts` merges these
into `organizationStatements` and the owner/admin roles (admin keeps the
catalog's `member: create/update/delete`, layered with `read`).

`organization.create` remains a valid grant (the owner role holds it), but it
is no longer the gate for creating an organization: that is the global
application-admin role, because creation must work with no organization
context (ADR-0007).

## Seeders (`database/seeders/seed/`)

- `organization.seeder.ts` — creates "Entragate" with the initial global
  admin as `owner` member in one `createOrganization({ userId })` call.
  **Skipped in production** (`prod`/`production`, see
  `config/providers/env.ts`) and keyed by slug via the exported
  `ensureOrganization({ name, slug, ownerEmail })`, so additional
  organizations can be seeded explicitly. Runs after `seedAuth()`.
- `organization-members.seeder.ts` — one account per internal role
  (16 accounts; excludes `owner` — the admin, and portal roles
  `investor`/`customer`). Emails `<role>.seed@entragate.local`, username
  `<role>_seed`, deterministic dev password `<role>123456`
  (per role, no env override). Idempotent: re-runs add missing roles only,
  never reset passwords or roles. Membership row existence is the skip check.
  The exported `addSeedMembersTo(organizationId)` joins the same accounts to
  any other organization; a missing "entragate" org is a no-op, not an error.
- `organization-roles.seeder.ts` — inserts the catalog per organization via
  the exported `seedRolesForOrganization(organizationId)`, which
  organization creation also calls so API-created organizations are
  provisioned.

## Frontend (`apps/web-admin`)

- `src/components/sidebar/organization-switcher.tsx` (renamed from
  `team-switcher.tsx`, history preserved): application admins see every live
  organization via the first-party list, everyone else sees their
  memberships via `useOrganizations()`; switch via `switchOrganization()`
  (server-side session fact) invalidating the permission cache, "Manage" →
  `/organizations`, "New organization" only via that page's gated entry.
- `src/lib/organization-api.ts` — typed fetch client + react-query options.
- Dedicated route pages (no dialog forms; destructive confirms remain
  `AlertDialog`):
  - `routes/_authed/organizations/index.tsx` — list (+restore for
    soft-deleted, gated "New organization").
  - `new.tsx` — create form (auto-slug, hidden behind
    `organization.create`).
  - `$organizationId.tsx` — detail: info tab + members tab, Edit link,
    soft-delete confirm.
  - `$organizationId.edit.tsx` — full-page edit form.
  - `$organizationId.members.new.tsx` — add member (userId + role select
    from `erpRoleNames`).
  - `$organizationId.members.$memberId.edit.tsx` — role change + remove
    member (confirm).
- Toasts via a minimal local bus (`src/components/toast.tsx`, `<Toaster />`
  in the root layout) — swap for sonner when queues/actions are needed.
- Permission gating is UX-only (`usePermission` → Better Auth
  `hasPermission`); the backend enforces everything.

## Verification (2026-11-02, multi-organization)

- `bun run typecheck` clean (backend); `bunx tsc -b` clean (web-admin);
  `bun test` backend 113 pass, web-admin 20 pass.
- Live smoke after the ADR-0007 change:
  - create a second organization → **201** (the former 422 is gone); the new
    organization is auto-activated for the creator and gets 19 role rows.
  - application admin with **zero memberships** creates the first
    organization → **201**, becomes `owner`, 19 roles provisioned.
  - organization owner without the application-admin role → **403**; anonymous
    → **401**.
  - delete a non-last organization → 200, caller's `activeOrganizationId`
    released; delete the final live organization → **409**.
- Earlier baseline (2026-10-31, single-org): member list (17), role change +
  revert → 200, remove non-owner → 200, re-add → 201, demote/remove last
  owner → 409.
- Seeders idempotent (second run: all skip, 0 created).
- No stale `erp` schema in the live DB (schemas: `auth`, `drizzle`,
  `location`, `sales`).

---

## Historical audit (NestJS backend, deleted)

> 2026-10-28: content below describes the deleted NestJS backend
> (apps/backend-nest). Treat as historical only.

## Dependencies and rules
