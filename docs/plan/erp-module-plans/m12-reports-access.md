# M12 — Reports and Access Rights

## Purpose

Who may do what, and who did what. Internal roles restrict both functions and
data. Every important action is audited. Reports can be exported and are
archived monthly. Stage 2 opens restricted access for customers and
investors to their **own** data only.

## Stage 1 scope (baseline)

- Internal roles with function **and** data restrictions.
- Audit trail.
- Exports.
- Monthly report archive.

_Interpretation, needs owner confirmation:_

- Roles (proposed at kickoff, T01): `owner`, `finance`, `admin`
  (sales/ops), `hr`, `warehouse`, `technician`. Each role maps to a
  permission set per module action (`read`, `create`, `approve`, `post`,
  `export`).
- Data restriction examples: a technician sees only projects/tickets
  assigned to them; salary data is limited to `hr`/`finance`/`owner`; only
  `owner` approves profit sharing.
- Audit: who, when, action, entity, before/after values, IP/user agent. It
  covers logins, approvals, postings, reversals, period lock/reopen, role
  changes, license overrides and exports.
- Exports: CSV/XLSX/PDF of list and report views, with the same permission
  as the view. Every export is audited.
- Monthly archive: at period close (S13), the P&L/BS/CF and the operational
  summaries are frozen as files linked to the period. They are read-only.

## Stage 2 scope (baseline) — add-on: Customer portal (accounts part, IDR 1,000,000 shared with M07)

- Customers and investors have restricted access to their **own** data.
- Protected documents.
- Cross-account access testing.

_Interpretation, needs owner confirmation:_

- Portal accounts: a customer account links to one CRM customer, and an
  investor account links to one investor record. Accounts are created by
  invitation from an admin. There is no open sign-up.
- Customer portal content (T25/T26): account, orders, documents
  (SPH/invoice/receipt), licenses, projects/BAST, own tickets.
- Investor portal content (T29/T30): see M11.
- Protected documents: downloads are ownership-checked on the server and
  served by short-lived signed URLs. Raw storage keys are never shown.
- Portal users can never reach `/admin/*` endpoints, and this is enforced by
  the guard, not by the menu.

## Explicit limits (out of scope)

- No employee app (no self-service attendance, leave or payslip portal).
- No portals or special roles beyond customer and investor.
- No custom role builder UI beyond assigning permissions to the fixed roles.
  _Interpretation, needs owner confirmation._
- No BI or report designer (see M01).

## Tasks

| ID | Task | PIC | Days | Price (IDR) |
|---|---|---|---|---:|
| T02 | Role-based login and audit | B | S1 2–3 | 337,500 |
| T25 | Customer accounts and documents | B | S2 11–15 | 600,000 |
| T30 | Data permissions and investor exports | B | S2 23–26 | 250,000 (shared with M11) |
| T31 | Integration, UAT, and final fixes (access security, regression) | A + B | S2 27–29 | 750,000 (shared) |

## SOPs

- **S13 Monthly reporting:** period close, financial/operational reports,
  owner review, archive/follow-up.
- Supports every SOP's approval and audit steps.

## Controls (v5.1 p.9)

- Internal roles use permissions that fit their functions.
- Customers and investors access **only their own** information,
  **including through APIs and downloads**.
- API secrets are kept in server configuration.
- Ownership is checked on the server for every endpoint, export and file.
  Frontend checks are UX only (`AGENTS.md`).
- Audit rows are append-only. No UI or API can edit or delete them.

## Acceptance

- UAT: role/audit/export scenarios in U01–U20 and portal and cross-account
  access scenarios in U21–U32, per Excel. Scenario text is not in the repo.
- _Interpretation:_ the tests use a matrix of each role against each
  sensitive endpoint (allowed or denied), customer A against customer B's
  resources (all denied, including the file URL), and investor A against
  investor B's resources.

## Definition of Done

Common DoD in [README.md](README.md), plus:

- The permission matrix is documented and covered by automated denial tests.
- Each portal endpoint has a cross-account test. A signed URL for one
  customer's file does not open another customer's file.
- Exports and the actions listed above produce audit rows (asserted in
  tests).
- Monthly archive files are immutable after close.

## Dependencies

- Needs: Better Auth (login, sessions), M02/M03/M07 (customer data), M11
  (investor data), M09 (period close for the archive).
- Provides: the auth/permission guards and the audit service to every
  module.

## Current state vs plan (checked 2026-11-04)

| Plan item | `docs.dbml` | Code |
|---|---|---|
| Login, sessions | `auth` (Better Auth core: users, sessions, accounts, verifications, passkeys, apikeys) | shipped (Better Auth in the Elysia chain) |
| Roles / permissions | code (`@ims-erp/common` `erpRoleNames`) on `auth.members.role` | shipped: `/admin/users`, `/admin/invitations` with web-admin UI |
| Audit | `audit.audit_logs` | shipped: `audit` module + `/admin/audit` UI |
| Self-service profile | `auth.user_profiles`, `user_preferences` | shipped: `/users/me*` (profile, avatar) |
| Portal identities | `auth.portal_identities` | none |
| Exports, monthly archive | (no explicit table; maybe `documents`) | none |

- Status: **implemented** for internal login, roles and audit (verified per
  `docs/plan/progress.md`; tests pass). Exports, archive and portals are
  **planned**. Business acceptance is not recorded.
- `beyond-baseline`:
  - (Reclassified 2026-11-04, ADR-0010: organizations are internal
    departments of one entity — consistent with v5.1, not beyond-baseline.)
    The `warehouse` role's stock actions are scoped to warehouses linked to
    the active organization; org `admin` gets read-only stock.
  - `passkeys`, `identity_verifications` and `user_devices`. These are extra
    auth features (cheap if Better Auth plugins provide them, but not
    requested).
  - The avatar pipeline (DiceBear + S3 + BullMQ worker). It is polish and
    not in any module.
