> 2026-10-28: content below describes the deleted NestJS backend (apps/backend-nest). Domains listed as modules/ stubs do not exist in apps/backend-elysia (which has only user, organization, location). Treat as historical audit; re-verify against backend-elysia before acting.

# User Module

## Purpose and boundary

System-user administration on top of Better Auth identities: listing,
activation/ban status, profile management, and association of users to
employee/customer/investor identities. Does **not** own credentials (Better
Auth) or role/permission decisions (see
[authentication & authorization](authentication.md)).

## Current state (audit, 2026-10-25)

**Partially implemented — the reference pattern for repositories.**

- `repositories/user.repository.ts` (383 lines, implemented):
  - `@InjectDrizzle()` + `@Inject(CACHE_MANAGER)` — correct DI (ADR-0005).
  - `TPaginationResult<TUserResultDTO>` envelope; alive-row discipline
    (`deletedAt IS NULL`) on every read/mutation.
  - Read-through cache per id (`user:<id>`; physical key prefixed
    `ims-erp:`), evict after every id-targeted write (even no-match), lists
    bypass cache, date-fields revived after JSON cache roundtrip
    (`reviveUser`).
  - Soft delete + restore; `forceDelete` (SQL DELETE cascading to
    auth-owned tables; `audit_logs.actor_id` set null) exists but must stay
    admin-gated.
  - TSDoc doc-comments per method — keep this documentation level.
- `contracts/user.repository.contract.ts` + `dto/user.dto.ts` exist.
- **Empty stubs:** `controllers/user.controller.ts` and
  `services/user.service.ts`; 2 failing pre-written specs
  ("should be defined").

## Key files

- `src/modules/user/**` (see layout above)
- Reuses `auth.users` (table ownership: authentication module)

## Data ownership

- Domain logic over `auth.users`; no ERP-owned table yet in this module.
  Future links to employee/customer/investor identities owned by those
  domains via exported contracts.

## Behavior targets (commercial scope: T02 role-based login and audit; M01)

- List/find/create/update/disable flows with permission gates (`users.view`,
  `users.create`, `users.update`, `users.disable`).
- Sensitive changes (ban, disable, role changes) audited.
- Frontend `users` pages consume the same envelope (pagination contract).

## Dependencies and rules

- Consumes authorization for checks; providers/tokens for DB and cache.
- Cross-module requests (e.g., user→employee join) go through employee's
  exported service/contract, never its repository.

## Tests

- Existing: 2 failing specs to green (implement controller/service).
- Required: permission-denial tests (low-privilege user cannot write via
  direct endpoint), cache eviction behavior, soft-delete visibility, list
  envelope counts.
