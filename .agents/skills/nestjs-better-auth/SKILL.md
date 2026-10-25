---
name: nestjs-better-auth
description: NestJS integration patterns for the @thallesp/nestjs-better-auth package — AuthModule.forRoot setup, global AuthGuard, @Session/@AllowAnonymous/@OptionalAuth decorators, system vs organization roles and permissions, hook decorators with NestJS DI, and Fastify CORS specifics. Use when configuring Better Auth inside a NestJS application or debugging its guards, decorators, or hooks. Does NOT cover Better Auth itself (use better-auth-best-practices / better-auth-security-best-practices / email-and-password-best-practices / organization-best-practices skills) or other NestJS concerns (use nestjs-best-practices).
license: MIT
metadata:
  author: OpenAgentic
  version: "1.0.0"
  source: https://github.com/ThallesP/nestjs-better-auth
---

# NestJS Better Auth Integration Best Practices

Integration guide for Better Auth in NestJS applications via `@thallesp/nestjs-better-auth`. Contains 10 rules across 6 categories, prioritized by impact. Requires `better-auth` >= 1.5.0 (older versions unsupported).

## When to Apply

Reference these guidelines when:

- Setting up `AuthModule.forRoot()` or bootstrapping the app (`bodyParser: false`)
- Protecting routes, controllers, GraphQL resolvers, or WebSocket gateways
- Accessing the session in controllers (`@Session()`, `req.session`, `req.user`)
- Calling Better Auth API endpoints server-side via `AuthService`
- Choosing between system roles and organization roles/permissions
- Writing Better Auth hooks with NestJS dependency injection
- Handling CORS for `trustedOrigins`, especially on Fastify

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Setup | CRITICAL | `setup-` |
| 2 | Route Protection | CRITICAL | `route-` |
| 3 | Session & Auth API | HIGH | `session-` |
| 4 | Authorization | HIGH | `authz-` |
| 5 | Hooks | MEDIUM-HIGH | `hooks-` |
| 6 | CORS | MEDIUM | `cors-` |

## Installation

```bash
npm install @thallesp/nestjs-better-auth
# better-auth >= 1.5.0 must already be installed and configured
```

## Module Options Reference

```typescript
AuthModule.forRoot({
  auth,
  disableTrustedOriginsCors: false,
  bodyParser: {
    json: { enabled: true },
    urlencoded: { enabled: true, extended: true },
    rawBody: false,
  },
  disableBodyParser: false,      // deprecated -> bodyParser.json.enabled / urlencoded.enabled
  enableRawBodyParser: false,    // deprecated -> bodyParser.rawBody
  disableGlobalAuthGuard: false,
  disableControllers: false,
  middleware: undefined,          // (req, res, next) wrapper around the Better Auth handler
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `disableTrustedOriginsCors` | `false` | Disables automatic CORS for `trustedOrigins`; set `true` to manage Better Auth route CORS yourself (required on Fastify with function-based `trustedOrigins`) |
| `bodyParser` | re-adds JSON + urlencoded parsers | Parsers re-added after Nest body parsing is disabled; each accepts parser options + `enabled?: boolean`; `rawBody?: boolean` enables `req.rawBody` |
| `disableBodyParser` | `false` | Deprecated; use `bodyParser.json.enabled` / `bodyParser.urlencoded.enabled` |
| `enableRawBodyParser` | `false` | Deprecated; use `bodyParser.rawBody` |
| `disableGlobalAuthGuard` | `false` | Skip global `AuthGuard` registration; apply guards manually or via `APP_GUARD` |
| `disableControllers` | `false` | Skip registering library controllers (handle routes manually) |
| `middleware` | `undefined` | `(req, res, next)` wrapper around the Better Auth handler, e.g., for MikroORM `RequestContext` |

## Quick Reference

### 1. Setup (CRITICAL)

- `setup-disable-body-parser` - Disable Nest's body parser; configure replacements (and `req.rawBody`) in `AuthModule.forRoot()`
- `setup-auth-module-options` - Know every `forRoot()` option; use `middleware` for request-context libraries

### 2. Route Protection (CRITICAL)

- `route-global-auth-guard` - Guard is global by default; use `@AllowAnonymous()` to expose, `@OptionalAuth()` for guest-friendly routes
- `route-websocket-graphql-guard` - Attach `AuthGuard` per Gateway/Message for WebSockets; resolvers are covered by the global guard

### 3. Session & Auth API (HIGH)

- `session-decorator-usage` - `@Session()` for typed sessions; `AuthService<typeof auth>` with `fromNodeHeaders()` for plugin APIs

### 4. Authorization (HIGH)

- `authz-roles-separation` - Never mix `@Roles()` and `@OrgRoles()`; they check different role fields by design
- `authz-permission-decorators` - `@UserHasPermission()` for system permissions, `@MemberHasPermission()` for organization permissions; requires access-control config

### 5. Hooks (MEDIUM-HIGH)

- `hooks-nestjs-di` - `@Hook()` classes with `@BeforeHook`/`@AfterHook` get NestJS DI; requires `hooks: {}` in `betterAuth()` config
- `hooks-database-lifecycle` - `@DatabaseHook()` with `@Before*`/`@After*` model lifecycle hooks; requires `databaseHooks: {}`

### 6. CORS (MEDIUM)

- `cors-fastify-trusted-origins` - Module manages Better Auth route CORS from `trustedOrigins`; Fastify fallback is array-based only

## References

1. [nestjs-better-auth README](https://github.com/ThallesP/nestjs-better-auth)
2. [Better Auth docs](https://www.better-auth.com/docs)
3. [Admin plugin access control](https://www.better-auth.com/docs/plugins/admin/access-control)
4. [Organization plugin access control](https://www.better-auth.com/docs/plugins/organization#access-control)

## Source Files

| File | Description |
|------|-------------|
| [references/](references/) | Individual rule files with incorrect/correct examples |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [AGENTS.md](AGENTS.md) | Agent-oriented index with impact rationale |
