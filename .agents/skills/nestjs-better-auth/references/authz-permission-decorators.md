---
title: Pick the right permission decorator — user vs organization member
impact: HIGH
impactDescription: prevents authorization bypass across permission scopes
tags: authz, permissions, access-control, UserHasPermission, MemberHasPermission
---

## Pick the right permission decorator — user vs organization member

Two permission decorators exist for two scopes:

- `@UserHasPermission()` — system-wide permissions via the admin plugin's access control; checks the user's assigned role permissions
- `@MemberHasPermission()` — organization-scoped permissions via the organization plugin's access control; requires `session.activeOrganizationId`

Both require the corresponding access control (`createAccessControl` + roles) configured in `auth.ts` first — the decorators only enforce; they don't define permissions.

**Incorrect (what's wrong):**

```typescript
// org-scoped action guarded with a system-permission decorator
@UserHasPermission({ permission: { project: ['delete'] } })
@Delete('org/projects/:id')
deleteOrgProject() {} // ignores active organization; wrong scope
```

**Correct (what's right):**

```typescript
// auth.ts — define statements and roles once
const ac = createAccessControl({
  project: ['create', 'update', 'delete'],
} as const);

export const auth = betterAuth({
  plugins: [
    admin({ ac, roles: { admin: ac.newRole({ project: ['create', 'update', 'delete'] }) } }),
    organization({ ac, roles: { editor: ac.newRole({ project: ['create', 'update'] }) } }),
  ],
});
```

```typescript
@UserHasPermission({ permission: { project: ['create', 'update'] } })
@Post()
createProject() {} // system-level check

@MemberHasPermission({ permissions: { project: ['delete'] } })
@Delete(':id')
deleteOrgProject(@Session() session: UserSession) {} // org-level check, needs activeOrganizationId
```

**Options:**
- `permission` — single check (`{ project: ['create', 'update'] }`)
- `permissions` — multiple checks across resources (`{ project: ['create'], sale: ['create'] }`)
- `role` (server-only, `@UserHasPermission`) — check permissions for a specific role
- `userId` (optional) — check for a specific user instead of the current one

**When NOT to use this pattern:**
- If the check is a simple system role or org role, prefer `@Roles()` / `@OrgRoles()` — permission decorators are for fine-grained resource-action checks.

Reference: [nestjs-better-auth — Permissions](https://github.com/ThallesP/nestjs-better-auth#permission-based-access-control)
