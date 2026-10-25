---
title: Use @Hook classes for Better Auth hooks with NestJS dependency injection
impact: MEDIUM-HIGH
impactDescription: hooks can access services/repositories instead of being closure-bound to config
tags: hooks, DI, BeforeHook, AfterHook, APIError
---

## Use @Hook classes for Better Auth hooks with NestJS dependency injection

Better Auth hooks are usually defined as closures inside `betterAuth()` config, which cuts them off from NestJS dependency injection — they cannot inject services or repositories. The `@Hook()` provider pattern fixes this: decorate a class with `@Hook()`, mark methods with `@BeforeHook()` / `@AfterHook()` matching the hook name, and the class is resolved by Nest so every constructor dependency is available. Requires `hooks: {}` in `betterAuth()` config. Throw `APIError` to abort.

**Incorrect (what's wrong):**

```typescript
// Closure hook — no access to NestJS DI
export const auth = betterAuth({
  hooks: {
    before: async (ctx) => {
      const settings = await someGlobalDb.getSettings(); // manual global, untestable
      if (!settings.allow) {
        throw new APIError('FORBIDDEN');
      }
      return { context: ctx };
    },
  },
});
```

**Correct (what's right):**

```typescript
// auth.ts — must declare hooks to enable them
export const auth = betterAuth({ hooks: {} });

// app.hook.ts
import { Hook, BeforeHook, AfterHook } from '@thallesp/nestjs-better-auth';

@Hook()
export class AppHook {
  constructor(private readonly settingsService: SettingsService) {} // full DI

  @BeforeHook('/sign-up/email') // endpoint name from Better Auth docs
  async beforeSignUpEmail(ctx: GenericHookContext<BeforeRequestContext>) {
    const settings = await this.settingsService.get();
    if (!settings.allowSignups) {
      throw new APIError('FORBIDDEN', { message: 'Signups are disabled' });
    }
    return { context: ctx };
  }

  @AfterHook('/sign-up/email')
  async afterSignUpEmail(ctx: GenericHookContext<AfterRequestContext>) {
    // e.g., provision workspace for the new user
    return { context: ctx };
  }
}
```

**When NOT to use this pattern:**
- Hook names are endpoint-specific (`/sign-up/email`, `/get-session`, ...); verify the exact path in Better Auth's API reference — guessing names silently never fires.

Reference: [nestjs-better-auth — Hooks](https://github.com/ThallesP/nestjs-better-auth#hooks)
