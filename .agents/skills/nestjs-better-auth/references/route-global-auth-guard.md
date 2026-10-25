---
title: Global AuthGuard by default — @AllowAnonymous to expose, @OptionalAuth for guests
impact: CRITICAL
impactDescription: prevents unprotected public endpoints and 401s on legitimate guest traffic
tags: route, guard, decorator, AllowAnonymous, OptionalAuth
---

## Global AuthGuard by default — @AllowAnonymous to expose, @OptionalAuth for guests

The `AuthGuard` is registered globally, so every endpoint requires a valid session unless told otherwise. Public routes must be marked with `@AllowAnonymous()`; routes that work for both guests and users use `@OptionalAuth()` (guard passes without a session; `@Session()` then returns undefined if absent). The guard works at method and controller-class level — a class-level `@AllowAnonymous()` exposes the entire controller, which is often broader than intended.

**Incorrect (what's wrong):**

```typescript
@Controller('health')
export class HealthController {
  @Get()
  check() {} // 401 — global guard blocks unauthenticated health checks
}

@Controller('products')
@AllowAnonymous() // whole controller public — including admin mutations below
export class ProductsController {
  @Delete(':id')
  remove() {} // publicly deletable!
}
```

**Correct (what's right):**

```typescript
@Controller('health')
export class HealthController {
  @AllowAnonymous()
  @Get()
  check() {}
}

@Controller('products')
export class ProductsController {
  @OptionalAuth() // guests get empty list, users get personalized data
  @Get()
  list(@Session() session?: UserSession) {}

  @Delete(':id') // still protected by the global guard
  remove() {}
}
```

**When NOT to use this pattern:**
- `@OptionalAuth()` only bypasses the guard when no session exists; with an invalid (not merely absent) session, requests still fail.
- If you set `disableGlobalAuthGuard: true`, you must attach `AuthGuard` per controller/method yourself or via `APP_GUARD` — otherwise everything is open.

Reference: [nestjs-better-auth — Route protection](https://github.com/ThallesP/nestjs-better-auth#route-protection)
