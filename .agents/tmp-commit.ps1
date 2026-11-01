git add -A
git commit -m "feat(user-management): phase 1+2 - lifecycle schema, dynamic roles, invitation module, claim flow

Phase 1 (schema):
- auth.roles per-org dynamic role master data (rank owner=100 admin=80 hr=60 member=10, catalog roles=50, soft delete + partial unique)
- auth.users.status lifecycle column (pending|active|deactivated) with Better Auth additionalFields passthrough
- auth.user_invitations unified pipeline (SHA-256 tokenHash, 3-day expiry, resend counter, soft delete)
- organization-roles seeder (idempotent, isSystem=true)

Phase 2 (invitation module + claim):
- user-management module: contracts, errors, token utils, repositories, gateway, mailer, audit/role/invitation services, controllers, wired in index.ts
- claim flow: credentials via Better Auth internal adapter, membership attach BEFORE accept (retryable on failure), org name via internal adapter (getFullOrganization 401s without session), post-claim auto-login with real request headers
- invite edge cases: findAnyByEmail/restore - re-invite of claimed email -> 409, soft-deleted user restored on re-invite
- audit.audit_logs append-only trail (schema + DBML entry replacing stale aspirational one)
- elysia-auth guardResolve policy context fix (Object.assign with erp)

Verified: live smoke of both invite paths, custom-role attach (technician), token reuse/cancel/resend/overwrite/bulk fallback, audit rows; tsc clean, 78/78 tests, validate-dbml OK"
