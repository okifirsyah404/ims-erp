# User Management Plan — Closed Internal ERP

> Status: approved plan (sharpened through grilling session)
> Scope: user lifecycle via invitation, dynamic organization roles, admin UI

## Context

Closed internal application — no public self-signup. Accounts are created **only**
via invitation. Two invitation paths:

1. **App admin** → name + email → user pre-created, default app role `user`,
   not attached to any organization.
2. **Org admin / HR** → email + role → user pre-created and attached to the
   organization with the chosen role.

Claim flow (both paths): invitation email link → credentials form (username,
password, phone) → profile form (name, avatar optional, bio) → active session.

## Locked Decisions

| # | Decision |
|---|---|
| D1 | Unified custom `invitation` table for both app-admin and org-admin/HR paths (not the org plugin's invitation system) |
| D2 | Users are **pre-created** at invite time (`status: pending → active → deactivated`); resend reuses the same user row; old token dies on resend/overwrite |
| D3 | App-level roles = Better Auth `admin()` plugin (`admin` / `user`) |
| D4 | Org roles = **dynamic** `role` table per org (`owner`/`admin`/`hr` seeded as `isSystem`, rank + jsonb permissions), checked by custom `hasPermission`; `organization()` plugin used only for membership/session plumbing |
| D5 | Escalation guard, server-side rank comparison (owner=100, admin=80, hr=60, member=10; custom roles ranked below creator's rank). HR assigns `member` only; last-owner protection; cannot modify member with rank ≥ own |
| D6 | App admin, org owner, and org admin can direct-attach existing users to an org (default role `member`) |
| D7 | Claim flow: credentials form → login allowed → forced redirect to profile completion (option A) |
| D8 | Username is a **login credential** (username plugin already installed); login form gets Email/Username tabs |
| D9 | Soft delete + restore; deactivate revokes all sessions; partial unique indexes `WHERE deleted_at IS NULL` |
| D10 | Avatar: reuse existing BullMQ + DiceBear initials → S3 pipeline; fallback to placeholder, retry 3× then mark `failed` (silent to user) |
| D11 | Email: logger stub now; invitation sending through a new BullMQ queue so SMTP drops in later. Bounce → flag invitation `deliveryFailed` |
| D12 | Audit log table + admin read UI |

## Rules established during grilling

- Invitation tokens: single-use, 3-day expiry, hashed at rest, rate-limited attempts.
- Invitation `delete` (by admin, wrong email) only allowed while user `pending`;
  after claim → **deactivate** instead.
- Username availability: live check endpoint.
- Password: Better Auth default policy (min 8).
- Profile completion is mandatory; cannot be skipped (form 2 after login, option A).
- Email on the claim page is read-only.
- Duplicate pending invite for same email: **overwrite** — same user row, new token,
  old token invalidated.
- Re-inviting a soft-deleted email: **restore** the soft-deleted user.
- Deactivate: revoke all sessions, memberships kept, restore brings full context.
- Org creation: **app admin only**; creator auto-joins the org as `owner`.
- App admin is one of the organization owners.
- Direct-attach default role = `member`; higher roles subject to rank guards.
- Bulk invites: paste-in rows, cap 100 per batch, per-row role validation
  (typo/unapproved role → fallback to `member`), per-row failure report.

## Backend — new module `src/app/user-management/` (hexagonal, per elysia-module skill)

### Schema (`src/drizzle/schemas/`)

- `role` (pgSchema `auth`): `id, orgId, name, rank, permissions jsonb, isSystem,
  timestamps`; partial unique `(orgId, name) WHERE deleted_at IS NULL` if soft-deletable.
- `invitation`: `id, type ('app'|'org'), email, name, orgId?, roleId?, tokenHash,
  status ('pending'|'accepted'|'cancelled'|'expired'), invitedBy, expiresAt (3d),
  resentCount, timestamps`.
- `user_status` additionalField on users: `pending | active | deactivated`.
- `audit_log`: `id, actorId, action, targetType, targetId, orgId?, meta jsonb, createdAt`.
- Seed system roles (`owner`, `admin`, `hr`) on org-creation hook; migrate the static
  `erpRoleGrants` catalog (19 roles) → seeded per-org `role` rows; existing
  `member.role` strings map to these.

### Endpoints

- `POST /invitations` — single + bulk (≤100 rows, per-row role validation → fallback `member`).
- `GET /invitations?status=pending` — pending list w/ expiry.
- `POST /invitations/:id/resend` — new token, old invalidated.
- `POST /invitations/:id/cancel`
- `DELETE /invitations/:id` — only if `pending` → soft-delete unclaimed user row.
- `POST /invitations/claim/:token` — validate token, server-side `setUserPassword`,
  set username/phone, invitation → `accepted`, create member row for org invites.
- `GET /users/username-available?u=` — live availability check.
- User management: list (filterable, incl. `pending`), deactivate (revoke sessions),
  restore, soft-delete, direct-attach to org.
- `hasPermission(memberId, "resource:action")` — custom server-side check replacing/
  augmenting static `organization-ac.ts` checks in `elysia-auth.ts` (erpGuard).
- Org creation: app-admin only; creator auto-joins as `owner`.

### Queues

- `invitation.queue` + worker: render invite email → `sendEmail()` (logger today,
  SMTP later); bounce → flag invitation `deliveryFailed`.

### Audit events

`invitation.sent|resent|cancelled`, `user.precreated|claimed|deactivated|restored|deleted`,
`role.created|updated|deleted`, `member.added|removed|roleChanged`, `org.created`.

## Frontend — `apps/web-admin`

- **Login** (`src/components/form/login-form.tsx` + `packages/ui`): Tabs
  (Email / Username), `authClient.signIn.username`.
- **Claim page** (public route `/invite/:token`): token validation → credentials
  form (username availability check, password ≥8, phone) → profile form (name
  prefilled, avatar optional) → session.
- **Users admin page** (new `_authed/users/`): table with status badges, invite
  dialog (single + bulk paste `name,email` / `email,role`), pending-invitations
  panel with resend/cancel/expiry.
- **Roles page** (`_authed/organizations/$orgId/roles/`): role CRUD
  (owner/app-admin), permission matrix editor, rank guard UI.
- **Members page**: role dropdown filtered by inviter rank; direct-attach user
  picker (app-admin/owner/admin).
- **Audit log page** (`_authed/audit/`): filterable table.
- Permission UI gating via existing `use-permission.tsx`.

## Bootstrap & sequencing

1. Schema + migrations (role, invitation, status, audit_log) + seeders.
2. Invitation module + claim flow (logger email).
3. Dynamic role table + `hasPermission` guard swap.
4. Admin UI (users → invitations → roles → members → audit).
5. Login form username tab.
6. Deactivate/restore/soft-delete + session revocation.
7. Verify existing avatar pipeline fires on claim (reuse as-is).
