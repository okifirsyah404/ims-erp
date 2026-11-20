# auth (modules `user` + `organization`) - ERP-0072

Schema `auth` (shared, Q9) · folders `src/app/user`, `src/app/organization` ·
URLs `/users`, `/admin/users`, `/organizations`, `/admin/invitations`,
self-service unchanged · phase P1

## Current

- Drizzle: `auth.schema.ts` (Better Auth core), `role.schema.ts`
  (`user_invitations`), `portal.schema.ts` (`portal_identities`),
  `organization.schema.ts` (`organization.settings`).
- `user` repositories: invitation, portal-identity, user-management, user.
  Controllers: invitation, portal-account (`/admin/portal-accounts`),
  user-admin, user.
- `organization` repository `organization.repository.ts` imports the
  **inventory** schema (violation). Controllers: organization-bootstrap,
  organization-invitation, organization.
- `portal` module: controller only (`/portal/v1`, `/portal/v1/auth`), no
  repository.

## Target tables

| Table | Owner module | Note |
|---|---|---|
| Better Auth core (9) | user (users, sessions, accounts, verifications, passkeys, apikeys) / organization (organizations, members, invitations) | never `auth:generate`; hand-written edits |
| user_invitations | user | unchanged |
| organization_settings | organization | from `organization.settings`; adds the fiscal columns as rows/keys (`fiscal.year_start_month`, `fiscal.business_timezone`, `fiscal.default_currency_code`) - key-value, no new columns |

## Steps

1. **dbml** - remove the `organization` and `code_number` modules, the four
   unbuilt auth extensions and `auth.portal_identities`; add
   `auth.organization_settings`; update the project note (schema count,
   shared-auth exception).
2. **Drizzle** - fold `role.schema.ts` into `auth.schema.ts` (ERP section);
   delete `portal.schema.ts`, `organization.schema.ts`; declare
   `organizationSettings` on `authSchema`.
3. **Repositories**
   - user: delete `portal-identity.repository.ts`; keep invitation,
     user-management, user (one per table: split if a repository serves two
     tables - `user-management` covers users only).
   - organization: `organization.repository.ts` loses the inventory import;
     add `organization-settings.repository.ts`; add `member.repository.ts`
     if member queries live elsewhere.
4. **Services**
   - Publish `ExportedUserService` (repository + Better Auth gateway port):
     `assertUser`, `getUsersByIds`, `createPortalLogin(email, name)`,
     `disablePortalLogin(userId)` - used by `customer` for portal logins (Q28).
   - organization: warehouse counts/names now come from
     `ExportedWarehouseService` (inventory) injected into the service, not
     the repository.
   - Delete the `portal` module; its auth flow (email code sign-up, session
     check) moves to `customer` and calls `ExportedUserService`.
5. **Controllers** - `/admin/portal-accounts` moves to
   `/admin/customers/portal-accounts` (customer module). Others keep their
   paths (`/users`, `/organizations`, `/admin/*`, `/invitations/claim/:token`).
6. **Consumers** - web-admin `portal-account-api.ts` -> customer URLs;
   `organization-api.ts` settings calls -> `organization_settings` payload.
   web-customer-portal `src/api/portal.ts` -> `/customers/portal/v1/*`.

## Exit

No repository under `user`/`organization` imports a non-auth schema;
`portal` folder, container registration and `app.ts` mount removed; ERP role
and invitation tests green.
