---
title: Use @DatabaseHook classes for database lifecycle hooks
impact: MEDIUM-HIGH
impactDescription: enables DI in create/update/delete lifecycle logic while keeping adapters optional
tags: hooks, databaseHooks, DatabaseHook, lifecycle
---

## Use @DatabaseHook classes for database lifecycle hooks

Better Auth's `databaseHooks` (create/update/delete, before/after on user, session, account, verification) are also normally closures. With `@DatabaseHook()`, each lifecycle method is a decorated method on a Nest-managed class: `@BeforeUserCreate`, `@AfterUserCreate`, `@BeforeUserUpdate`, `@AfterUserUpdate`, `@BeforeUserDelete`, `@AfterUserDelete`. Requires `databaseHooks: {}` in `betterAuth()` config. Same decorator set exists for sessions (`...Session*`), accounts (`...Account*`), and verification (`...Verification*`).

Return semantics matter: **before** hooks return `false` to abort or `{ data }` to modify the object; **after** hooks may return `{ data }` to modify the returned object.

**Incorrect (what's wrong):**

```typescript
export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // closure — cannot inject AuditService
          await globalAudit.log('user-created', user.id);
          return { data: { ...user, emailVerified: false } };
        },
      },
    },
  },
});
```

**Correct (what's right):**

```typescript
// auth.ts
export const auth = betterAuth({ databaseHooks: {} });

// user.hook.ts
@DatabaseHook()
export class UserHook {
  constructor(private readonly audit: AuditService) {} // full DI

  @BeforeUserCreate()
  async beforeUserCreate(user: User) {
    await this.audit.log('user-created', user.id);
    return { data: { ...user, emailVerified: false } };
  }

  @BeforeUserDelete() // return false to prevent deletion
  async beforeUserDelete(user: User) {
    if (user.role === 'admin') return false;
  }

  @AfterUserCreate()
  async afterUserCreate(user: User) {
    await this.audit.log('user-created', user.id);
    return { data: user }; // optional: modify the returned object
  }
}
```

**When NOT to use this pattern:**
- Adapters are optional — you only need the database adapter (e.g., Drizzle) if you type hook parameters with its generated types; `@DatabaseHook()` works without it.
- All decorators accept an options object as first argument (e.g., to scope which model/event the hook applies to) when the method-level default is not enough.

Reference: [nestjs-better-auth — Database Hooks](https://github.com/ThallesP/nestjs-better-auth#database-hooks)
