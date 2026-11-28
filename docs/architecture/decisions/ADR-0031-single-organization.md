# ADR-0031 - Single organization: the ERP serves one company

- **Status:** accepted (2026-11-28, decision K12 as amended 2026-11-28 by
  programmer B, approved by the owner).
- **Numbering note:** number reserved at PR time; renumber if ADR-0031 is
  taken by an earlier PR.
- **Amends:** ADR-0001, ADR-0007 and ADR-0012 (multi-organization). Those
  records stay as history; their multi-organization rules no longer apply.
- **Task:** M12-2 (`docs/adjustment/5-pengerjaan/peta-kode-oki.md`).

## Context

K12 originally said "remove the organization layer": one company, roles no
longer per organization, `organization_id` dropped from 18 schema files. That
is a large change: Better Auth owns `auth.organizations`, `auth.members`,
`auth.invitations`, the session's `activeOrganizationId`, and the
`x-organization-id` request header; roles live in `auth.members.role`.

Removing the layer would have to migrate roles, invitations, sessions and every
`organization_id` column at once, with no functional gain for the business:
there is one company, and it already exists.

## Decision

The organization layer **stays**; the application simply never has more than
one organization.

1. **Creation is closed.** `allowUserToCreateOrganization` in the Better Auth
   organization plugin returns `false`, and
   `OrganizationService.createOrganization` throws
   `OrganizationAlreadyExistsError` (409, key
   `organization.singleOrganization`) before calling the gateway. The first
   organization is provisioned by the seeder, whose Better Auth call passes an
   explicit `userId` (a system action that skips the plugin gate).
2. **No switcher.** The web-admin sidebar and the employee-portal sidebar show
   the active organization as a static identity card; `POST /organizations`
   stays mounted but always answers 409 with a translated message.
3. **Nothing else changes.** `auth.organizations`, `auth.members`,
   `auth.user_invitations`, roles in `auth.members.role`, the
   `x-organization-id` header, and every `organization_id` column remain. A
   session still carries `activeOrganizationId`, filled automatically by the
   session hook with the caller's only organization (OA2).
4. **Profile, members and roles stay editable.** `/organizations` keeps the
   detail page (profile, members, roles); only creation is gone.

## Consequences

- No migration, no `docs.dbml` change, no seed change: the schema is
  untouched.
- An installation without any organization has no UI or HTTP path to create
  one; it must run the seeder. This is accepted (owner decision, 2026-11-28).
- `DELETE /organizations/:id` keeps refusing the last organization
  (`LastOrganizationError`), which is now every organization in practice.
- If the business ever needs a second company, reopening creation means
  deleting one guard in the service and one gate in the plugin.
