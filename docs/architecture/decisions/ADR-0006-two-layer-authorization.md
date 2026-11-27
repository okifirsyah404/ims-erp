# ADR-0006: Two-layer authorization (global admin vs ERP organization roles)

Date: 2026-10-29
Status: accepted
**Status update 2026-11-28 (T-6, recorded by programmer B, reviewed by Oki):** item 6 **will be amended** in task P7-2 (decision K1: the owner may approve their own documents, recorded in the audit log; manual journals still need a second person).

## Context

The backend migrated from NestJS to ElysiaJS. Better Auth's `admin()` and
`organization()` plugins were both present but unconfigured. ERP role
definitions from the NestJS era needed a home that works with Better Auth
primitives rather than a competing role system.

## Decision

1. **Two separate layers.**
   - `admin()` keeps only global roles `admin`/`user` with default
     permissions, for account/session administration only.
   - All ERP authorization uses `organization()` membership roles via
     `createAccessControl` (static, code-defined; dynamic access control off).

2. **No tenant bypass for global admins.** The Elysia guard validates
   organization membership server-side on every protected request; a global
   admin without membership is denied like anyone else. The single exception
   is organization *creation* (ADR-0007), which is an application-admin action
   that must work without an organization context — it rides `sessionGuard`
   and only creates; it grants no access to any existing organization's data.

3. **Single source of truth for the vocabulary.** The resource/action
   catalog and role grants live in `@ims-erp/common`
   (`erp-permissions.ts`), browser-safe. The backend composes Better Auth
   access control from it; the frontend composes the client access control
   from the same data. Server/client drift is impossible by construction.

4. **Deny-by-default roles.** Only explicitly granted statements pass.
   Built-in organization resources (organization/member/invitation/ac) are
   preserved in the statement vocabulary and granted only where policy
   requires (owner, org admin).

5. **Guard as an Elysia macro.** `erpGuard()` registers one macro (`erp`);
   authorization runs in the resolve phase before handlers and cannot be
   skipped by plugin ordering. Organization selection: explicit
   `x-organization-id` header > session active organization; the same
   resolved id is used for membership, permission, queries, and audit.

6. **Separation of duties in services, not permissions.** Self-approval
   blocks, approve-before-execute state machines (conditional updates),
   and configuration-driven approval limits are enforced in the service
   layer, so multi-role combinations cannot bypass them.

7. **Escalation protection inside Better Auth.** `hooks.before` middleware
   restricts owner-role grants on the organization plugin's own
   membership/invitation endpoints.

## Consequences

- Role changes take effect on the next request (guard re-resolves
  membership); no long-lived role caches.
- Adding a permission or role touches exactly one shared file plus
  (optionally) tests; see security-and-access.md.
- Modules not yet built have registered vocabulary but no routes; each must
  adopt the `erp` macro and record-level scoping as it lands.
