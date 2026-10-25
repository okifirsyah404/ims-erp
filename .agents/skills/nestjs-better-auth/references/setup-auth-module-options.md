---
title: Know every AuthModule.forRoot option — use middleware for request-context libraries
impact: CRITICAL
impactDescription: avoids duplicate guard/controller wiring and broken request-context providers
tags: setup, forRoot, options, middleware
---

## Know every AuthModule.forRoot option — use middleware for request-context libraries

`AuthModule.forRoot()` registers controllers, the global `AuthGuard`, and Better Auth route CORS automatically. Blindly re-registering these yourself (or skipping the module options) creates duplicate handlers and confusing behavior. For request-context libraries (e.g., MikroORM's `RequestContext`), the `middleware` option wraps the Better Auth handler so context providers work inside auth routes.

**Incorrect (what's wrong):**

```typescript
// Guard applied twice (module global + APP_GUARD), controllers disabled by accident
providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
AuthModule.forRoot({ auth, disableControllers: true }), // routes silently missing
```

**Correct (what's right):**

```typescript
AuthModule.forRoot({
  auth,
  // Default behavior (all omitted options use defaults):
  disableTrustedOriginsCors: false,  // module manages CORS for trustedOrigins
  bodyParser: {                      // parsers re-added after Nest's are disabled
    json: { enabled: true },
    urlencoded: { enabled: true, extended: true },
    rawBody: false,
  },
  disableGlobalAuthGuard: false,     // set true only if wiring guards yourself (APP_GUARD / per-route)
  disableControllers: false,         // set true only if you handle routes manually
  middleware: (req, res, next) => {  // wrap handler for request-context libraries
    RequestContext.createAsync(orm.em, next);
  },
}),
```

**When NOT to use this pattern:**
- `disableBodyParser` / `enableRawBodyParser` are deprecated aliases — always use the `bodyParser` object (`json.enabled`, `urlencoded.enabled`, `rawBody`).
- Don't set `disableGlobalAuthGuard: true` without a concrete plan for guard wiring (see route-global-auth-guard).

Reference: [nestjs-better-auth — Module options](https://github.com/ThallesP/nestjs-better-auth#module-options)
