# Organization Module

> Updated 2026-10-31. Reflects the Elysia backend (`apps/backend`) and
> web-admin implementation. Supersedes the historical NestJS audit below the
> divider at the end of this file.

## Purpose and boundary

The single business entity (ADR-0001) modeled through Better Auth's
`organization` plugin: the organization row, its membership, and member role
administration. **Not** a tenant dimension — no `organization_id` columns on
master data (migration path recorded in ADR-0001). Invitations are out of
scope for v1 (direct member add only); company profile/address data belongs
to a future settings owner, not here.

## Single-organization invariant

This deployment runs exactly ONE organization (seeded: "Entragate",
slug `entragate`). Enforced in `OrganizationService.createOrganization`:
`POST /organizations` responds **422** when any organization row exists,
soft-deleted included. The UI hides creation once an org exists.

## Session auto-activation

`sessionAutoActivateOrganizationHook`
(`src/providers/better-auth/options/session.auth.ts`, wired as
`databaseHooks.session.create.before` in `auth.options.ts`) stamps the
user's first `members` row (by oldest `createdAt`) as
`activeOrganizationId` when a **new** session is created. Effect: after
login, every `erpGuard` route resolves an organization context with no
`x-organization-id` header needed; users without membership keep `null`
and correctly get 403 from org routes.

Caveat: the value is stamped at session creation — sessions created
before this hook existed keep their stored value and need one re-login
(or one manual switch via the org switcher).

## Backend (`apps/backend/src/app/organization/`)

Standard module layout: `contracts/` (zod + interfaces), `repositories/`,
`services/`, `routes/`, `containers/`, `constants/`.

- **Repository** — Drizzle over Better Auth–owned `auth.organizations` /
  `auth.members`. Write surface limited to `deletedAt` (soft delete/restore);
  membership and profile mutations go through the Better Auth gateway.
- **Gateway** (`better-auth-organization.gateway.ts`) — wraps `auth.api`:
  `createOrganization` (server-side, creator becomes owner),
  `updateOrganization`, `getFullOrganization`, `addMember`,
  `updateMemberRole`, `removeMember`. Caller headers forwarded where Better
  Auth runs its own authorization. Organization DELETE intentionally does
  NOT use `auth.api.deleteOrganization` (hard delete) — service routes it to
  the repository's `softDelete`.
- **Service** — single-org invariant, soft-delete/restore, last-owner
  protection (`countOwners` before role change/removal), member listing with
  user join.
- **Controller** (`routes/organization.controller.ts`) — mounted at
  `/organizations` via `OrganizationController.plugin()` in `src/index.ts`;
  every route behind `erpGuard` with `organization:*` / `member:*`
  permission requirements.

### Routes

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/organizations` | `organization:create` | 422 when an org exists |
| GET | `/organizations` | `organization:read` | paginated; `includeDeleted=true` |
| GET | `/organizations/:organizationId` | `organization:read` | |
| PATCH | `/organizations/:organizationId` | `organization:update` | name/logo/metadata |
| DELETE | `/organizations/:organizationId` | `organization:delete` | soft delete |
| POST | `/organizations/:organizationId/restore` | `organization:delete` | clears deletedAt |
| GET | `/organizations/:organizationId/members` | `member:read` | paginated, joined users |
| POST | `/organizations/:organizationId/members` | `member:create` | direct add by userId |
| PATCH | `/organizations/:organizationId/members/:memberId` | `member:update` | role change; 409 last owner |
| DELETE | `/organizations/:organizationId/members/:memberId` | `member:delete` | 409 last owner |

Domain errors map to 404/409/422 envelopes (see
`services/organization.errors.ts`).

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

## Seeders (`database/seeders/seed/`)

- `organization.seeder.ts` — creates "Entragate" with the initial global
  admin as `owner` member in one `createOrganization({ userId })` call.
  Skipped when any org exists. Runs after `seedAuth()`.
- `organization-members.seeder.ts` — one account per internal role
  (16 accounts; excludes `owner` — the admin, and portal roles
  `investor`/`customer`). Emails `<role>.seed@entragate.local`, username
  `<role>_seed`, deterministic dev password `<role>123456`
  (per role, no env override). Idempotent: re-runs add missing roles only,
  never reset passwords or roles. Membership row existence is the skip check.

## Frontend (`apps/web-admin`)

- `src/components/sidebar/organization-switcher.tsx` (renamed from
  `team-switcher.tsx`, history preserved): real org list via
  `useOrganizations()`, switch via `switchOrganization()` (server-side
  session fact), "Manage" → `/organizations`, "New organization" only via
  that page's gated entry.
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

## Verification (2026-10-31)

- `bun run typecheck` clean (backend + web-admin); `bun test` 78 pass.
- Live smoke: list (1 org, Entragate), duplicate create → 422, member list
  (17), role change + revert → 200, remove non-owner → 200, re-add → 201,
  demote/remove last owner → 409.
- Seeders idempotent (second run: all skip, 0 created).
- No stale `erp` schema in the live DB (schemas: `auth`, `drizzle`,
  `location`, `sales`).

---

## Historical audit (NestJS backend, deleted)

> 2026-10-28: content below describes the deleted NestJS backend
> (apps/backend-nest). Treat as historical only.

## Dependencies and rules
