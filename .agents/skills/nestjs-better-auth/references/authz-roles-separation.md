---
title: Never mix @Roles() and @OrgRoles() — they check different fields by design
impact: HIGH
impactDescription: prevents privilege-escalation between system and organization roles
tags: authz, roles, organization, escalation
---

## Never mix @Roles() and @OrgRoles() — they check different fields by design

The two role decorators are intentionally separate to prevent privilege escalation:

- `@Roles(['admin'])` — checks only `user.role` (system-level, admin plugin)
- `@OrgRoles(['owner', 'admin'])` — checks the active organization + the member's organization role
- `@RequireActiveOrg()` — requires `session.activeOrganizationId`, no specific role

An organization admin must not satisfy `@Roles(['admin'])`, and a system admin must not bypass organization checks. Choosing the wrong decorator (or "combining" them defensively) breaks this boundary in one direction or the other.

**Incorrect (what's wrong):**

```typescript
// Org admin can now reach a SYSTEM-level endpoint (escalation)
@Roles(['admin', 'owner']) // 'owner' is an org role, not a system role
@Get('system/settings')
systemSettings() {}

// Mixing decorators gives OR-like confusion; each check runs independently
@Roles(['admin'])
@OrgRoles(['owner'])
@Get('mixed')
mixed() {}
```

**Correct (what's right):**

```typescript
@Roles(['admin']) // user.role === 'admin' only; org admins CANNOT access
@Get('admin/dashboard')
adminDashboard() {}

@OrgRoles(['owner', 'admin']) // requires activeOrganizationId + matching member role
@Get('org/settings')
orgSettings(@Session() session: UserSession) {}

@RequireActiveOrg() // any authenticated user with an active organization
@Controller('projects')
export class ProjectsController {
  @Get()
  list(@Session() session: UserSession) {}
}
```

**When NOT to use this pattern:**
- Both decorators accept arbitrary role strings you define in Better Auth; the org creator automatically gets `owner`. Custom org roles work with `@OrgRoles()` as long as the organization plugin stores them as member roles.

Reference: [nestjs-better-auth — RBAC](https://github.com/ThallesP/nestjs-better-auth#role-based-access-control)
