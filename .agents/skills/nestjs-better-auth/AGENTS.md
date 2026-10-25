# NestJS Better Auth

**Version 1.0.0**
OpenAgentic
October 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring codebases. Humans may also find it useful,
> but guidance here is optimized for automation and consistency by AI-assisted workflows.

---

## Abstract

Integration guide for Better Auth in NestJS applications via `@thallesp/nestjs-better-auth`, designed for AI agents and LLMs. Requires `better-auth` >= 1.5.0 (older versions unsupported). Covers module setup, route protection (REST, GraphQL, WebSocket), session access, system vs organization authorization, hook decorators with NestJS dependency injection, and CORS handling. Better Auth library-agnostic concerns (plugins, security hardening, email/password flows, organization setup) are covered by the dedicated `better-auth-*` skills. Contains 10 rules across 6 categories, prioritized by impact from critical (module setup, route protection) to incremental (CORS).

---

## Table of Contents

1. [Setup & Registration](references/_sections.md#1-setup--registration) — **CRITICAL**
   - 1.1 [Disable Nest's Body Parser and Let AuthModule Own Body Parsing](references/setup-disable-body-parser.md) — CRITICAL (Nest's parsers would consume/alter the raw body before Better Auth sees it; disabling without re-adding parsers leaves `req.body` empty on auth routes)
   - 1.2 [Know Every AuthModule.forRoot Option](references/setup-auth-module-options.md) — CRITICAL (Re-registering the global guard or disabling controllers by accident creates duplicate handlers and silent gaps; `middleware` is required for request-context libraries like MikroORM)
2. [Route Protection](references/_sections.md#2-route-protection) — **CRITICAL**
   - 2.1 [Global AuthGuard by Default](references/route-global-auth-guard.md) — CRITICAL (Every route requires a session unless marked; forgetting `@AllowAnonymous()` breaks public endpoints, and class-level decorators over-expose entire controllers)
   - 2.2 [Attach AuthGuard Explicitly to WebSocket Gateways](references/route-websocket-graphql-guard.md) — CRITICAL (WebSocket gateways bypass the global guard; undecorated gateways accept unauthenticated connections silently)
3. [Session & Auth API](references/_sections.md#3-session--auth-api) — **HIGH**
   - 3.1 [Use @Session() and AuthService Generics](references/session-decorator-usage.md) — HIGH (Ad-hoc request casts lose type safety; `AuthService<typeof auth>` exposes plugin-specific API methods that plain `AuthService` hides)
4. [Authorization](references/_sections.md#4-authorization) — **HIGH**
   - 4.1 [Never Mix @Roles() and @OrgRoles()](references/authz-roles-separation.md) — HIGH (They check `user.role` vs organization member roles by design; mixing them enables privilege escalation between system and organization scopes)
   - 4.2 [Pick the Right Permission Decorator](references/authz-permission-decorators.md) — HIGH (`@UserHasPermission()` and `@MemberHasPermission()` enforce different scopes; swapping them checks permissions against the wrong role set)
5. [Hooks](references/_sections.md#5-hooks) — **MEDIUM-HIGH**
   - 5.1 [Use @Hook Classes for Better Auth Hooks](references/hooks-nestjs-di.md) — MEDIUM-HIGH (Closure hooks cannot use NestJS dependency injection; `@Hook()` classes inject services and throw `APIError` to abort)
   - 5.2 [Use @DatabaseHook Classes for Database Lifecycle Hooks](references/hooks-database-lifecycle.md) — MEDIUM-HIGH (Same DI benefit for user/session/account/verification create-update-delete events; before hooks can return `false` or `{ data }`)
6. [CORS](references/_sections.md#6-cors) — **MEDIUM**
   - 6.1 [Let the Module Manage Better Auth Route CORS](references/cors-fastify-trusted-origins.md) — MEDIUM (Function-based `trustedOrigins` cannot resolve on the Fastify fallback; credentialed cross-origin auth requests fail unless you use a static array or manage CORS yourself)

---

## References

1. [https://github.com/ThallesP/nestjs-better-auth](https://github.com/ThallesP/nestjs-better-auth)
2. [https://www.better-auth.com/docs](https://www.better-auth.com/docs)
3. [https://www.better-auth.com/docs/plugins/admin/access-control](https://www.better-auth.com/docs/plugins/admin/access-control)
4. [https://www.better-auth.com/docs/plugins/organization#access-control](https://www.better-auth.com/docs/plugins/organization#access-control)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point |
| [metadata.json](metadata.json) | Version and reference URLs |
