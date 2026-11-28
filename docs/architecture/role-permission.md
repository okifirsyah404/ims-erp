# Roles, Permissions and Endpoints

> **Background.** This page describes the **current code**. Since P7-4 (ERP-0187, 2026-11-28) that is 13 organization roles: one Sales role, Finance holding the former Accountant grants, the organization `admin`/`accountant`/`auditor`/`sales_manager` roles removed, `member` kept as the base role every member carries, an extended Freelancer. The target role design stays in `docs/adjustment/`. The working scope is
> `docs/adjustment/` (target behaviour approved by the owner) and the code
> (current behaviour); see `AGENTS.md` "Source of truth".

Who may call which backend endpoint, and why. The first half of this page is
written by hand. The second half (role list, grants per role, every endpoint
with its guard and the roles that pass it) is **generated from code** by
`bun docs/architecture/gen-role-permission.ts`. Re-run it whenever a route, a guard option
or a role grant changes. Last regenerated for ERP-0187 / P7-4 (2026-11-28).

Authoritative sources, in this order: the code
(`packages/common/src/authorization/erp-permissions.ts`,
`apps/backend/src/authorization/`), then
`docs/architecture/security-and-access.md` (ADR-0006, ADR-0007, ADR-0017,
ADR-0018). This page summarises them; where they disagree, the code wins.

## Two kinds of role

| | App role | Organization role |
| --- | --- | --- |
| Stored on | `auth.users.role` (Better Auth `admin()` plugin) | `auth.members.role`, one row per organization |
| Values | `admin`, `user`, plus the portal roles `investor`, `customer` | the 13 `erpRoleNames` (closed enum, see below); every list starts with the base `member` role |
| Several at once | yes, comma-joined | yes, comma-joined; grants are the **union** |
| Grants | no ERP permission; `admin` manages accounts, sessions, organizations and app-wide settings; `investor` / `customer` open a portal | every business permission, **per organization** |

Hard rules that follow:

- **An app `admin` without a membership has no ERP access.** The guard checks
  membership in the selected organization on every protected request.
- **Creating an organization makes its creator the `owner`.** Only an app
  admin may create one (`POST /organizations`, `requireGlobalAdmin`), and
  Better Auth registers the creator as `owner`. So an app admin who created an
  organization sees and does everything in it, through the `owner` role, not
  through the app role. Another app admin who is not a member sees nothing.
- **Owner is born with the organization.** It cannot be put on an invitation;
  only an owner may promote another member to owner, and the last owner cannot
  be removed or demoted.
- Role assignment follows a ladder (`assignableOrganizationRoles`) over the
  offered roles (`offeredOrganizationRoles`: every role except the base
  `member`): `owner` may assign everything, any other member manager
  everything except `owner` and `hr`, and an app admin everything except
  `owner` unless they also hold an owner membership. Invitations never carry
  `owner`.
- **The base `member` role is added by the backend** on every role write
  (member add/update, invitation create and claim, organization create)
  through `withBaseMemberRole`; forms never offer it, and a payload that
  sends it is accepted. It grants only `ac:read`.
- Only the owner invites (`invitation:create`), reads the audit log
  (`audit_log:read`) and reopens an accounting period
  (`accounting_period:reopen`, checked by the period transition route when
  the target is `open`).

### Who may sign in where

| Surface | Allowed |
| --- | --- |
| Web admin (`apps/web-admin`) | an app `admin`, or a user with at least one internal organization role (`login-gate.ts`) |
| Customer portal (`/customers/portal/v1`) | users with the `customer` app role, scoped to their own customer |
| Investor portal | users with the `investor` app role, read-only, published records only |

The web-admin dashboard (`/`) is shown only to a user with an internal
organization role. Anyone else, including an app admin with no membership,
gets an explanation instead of a blank page; the app admin is pointed at the
organizations page.

## Guards a route can opt into

A route is protected only by the macro option it declares. A route with none
of these is **public**.

| Option | Plugin `guards` | Passes when |
| --- | --- | --- |
| `erp: { permission: [...] }` | `erp` | signed in, member of the selected organization (`x-organization-id` header, else the session's active organization), and the member's roles grant **every** listed `resource:action` |
| `erp: { policy }` | `erp` | as above, then a record-level check runs (ownership, assignment, self-approval) |
| `erpSession: { session: true }` | `session` | signed in; no organization needed (self-service, notifications) |
| `erpSession: { policy: requireGlobalAdmin }` | `session` | signed in **and** app `admin` (organization creation, warehouses) |
| `adminOrErp: { permission, appAdminOnly? }` | `admin-or-erp` | app `admin` always; otherwise as `erp`. With `appAdminOnly`, app admin only (code-numbering settings) |
| `warehouse: { action }` | `session+warehouse` | the caller is a person in charge (PIC) of that warehouse (ADR-0017) |
| `portal: true` | `portal` | a customer-portal session cookie |
| `publicApi: true` | `none` | a valid public API key (website catalog, license API) |

Status codes: no session `401`; no organization, no membership, a missing
permission or a failed policy `403`; a record outside the caller's scope
`404`.

Frontend checks (`usePermission`, `Can`, hidden menu items and dashboard
cards) are **UX only**. Every endpoint, including exports, counts and the
dashboard aggregates, re-checks on the server.

### Routes with no guard macro

A route listed with **no guard macro** has no session or role check in the
plugin chain. Some of them authenticate inside the handler instead:

| Routes | Credential checked by the handler |
| --- | --- |
| `/webhooks/:provider` | the provider's signature or callback token (owning module's webhook service) |
| `/projects/api/v1/licenses/*` | the application key, `Authorization: Bearer elk_…`, scoped to that application |
| `/sales/public/v1/render/quotations/:id` | a signed render token, valid 2 minutes for one quotation (404 otherwise) |
| `/documents/public/v1/shares/:token*` | the share-link token |
| `/invitations/claim/:token` | the invitation claim token |
| `/customers/portal/v1/auth/*` | none: these are the portal's sign-in, registration and password-reset steps |

The rest (`/locations/*` reference data, `/companies/branding`,
`/username-availability`, the public product image) are intentionally open.

## Not listed below

The generator reads the module controllers. These surfaces are mounted
elsewhere and are not in the table:

- `/api/auth/*`: the Better Auth handler, mounted raw in `apps/backend/src/app/app.ts`
  (sign-in, sessions, organization and member endpoints). Escalation is
  blocked by `auth-hooks.ts` (see `security-and-access.md`).
- The realtime websocket gateway (`realtimeGateway()`), which authenticates
  the session on connect.

<!-- BEGIN GENERATED: bun docs/architecture/gen-role-permission.ts -->

> Generated. Do not edit by hand; run `bun docs/architecture/gen-role-permission.ts`.

## Organization roles

| Role | English | Indonesian | Resources granted |
| --- | --- | --- | --- |
| `owner` | Owner | Pemilik | 80 |
| `member` | Member | Anggota | 1 |
| `operations_manager` | Operations Manager | Manajer Operasional | 21 |
| `sales` | Sales | Penjualan | 18 |
| `project_manager` | Project Manager | Manajer Proyek | 16 |
| `technician` | Technician | Teknisi | 11 |
| `freelancer` | Freelancer | Pekerja Lepas | 8 |
| `purchasing` | Purchasing | Pembelian | 12 |
| `warehouse` | Warehouse | Gudang | 11 |
| `finance` | Finance | Keuangan | 35 |
| `hr` | Human Resource | Sumber Daya Manusia | 16 |
| `customer_service` | Customer Service | Layanan Pelanggan | 12 |
| `marketing` | Marketing | Pemasaran | 12 |

## Permissions per organization role

Each role is a closed grant set from `erpRoleGrants`; a member holding several roles gets the union.

<details>
<summary><code>owner</code> (Owner)</summary>

| Resource | Actions |
| --- | --- |
| `company` | read, update |
| `code_number` | read, update |
| `payment_gateway` | read, update |
| `branch` | read, create, update, archive |
| `department` | read, create, update, archive |
| `master_data` | read, create, update, archive, import, export |
| `dashboard` | read |
| `customer` | read, create, update, archive, export |
| `lead` | read, create, update, assign, archive, export |
| `quotation` | read, create, update, submit, approve, reject, send, export |
| `sales_discount` | request, approve |
| `sales_order` | read, create, update, submit, approve, cancel, export |
| `sales_return` | read, create, update, submit, approve, receive, cancel |
| `supplier` | read, create, update, archive, read_bank |
| `purchase_request` | read, create, update, submit, approve, reject |
| `purchase_order` | read, create, update, submit, approve, send, cancel, export |
| `purchase_return` | read, create, update, submit, approve, ship, cancel |
| `project` | read, create, update, assign, close, export, read_cost |
| `task` | read, create, update, assign, submit, verify |
| `daily_report` | read, create, update, submit, verify, export |
| `kpi` | read, configure, evaluate, export |
| `advance` | read, create, update, submit, approve, reject, disburse |
| `settlement` | read, create, update, submit, verify, approve, reject |
| `employee` | read, create, update, archive, export, read_private |
| `employment_contract` | read, create, update, approve, export |
| `attendance` | read, check_in, check_out, request_correction, approve_correction, export, record |
| `leave` | read, create, cancel, approve, reject |
| `overtime` | read, create, cancel, approve, reject |
| `schedule` | read, create, update, delete |
| `disciplinary_record` | read, create, update, approve |
| `payroll` | read, create, calculate, update, submit, approve, export |
| `payroll_payment` | read, execute |
| `payslip` | read, publish, download |
| `product` | read, create, update, archive, import, export, read_cost |
| `warehouse` |  |
| `stock` | read, receive, issue, transfer, export |
| `stock_adjustment` | read, create, submit, approve, post |
| `asset_borrowing` | read, create, update, approve, issue, return, extend, mark_late, mark_lost, export |
| `invoice` | read, create, update, issue, void, export |
| `receipt` | read, create, verify, post, reverse, export |
| `payment` | read, create, submit, approve, execute, reverse, export |
| `bill` | read, create, record |
| `expense_claim` | read, create, update, submit, approve, reject, cancel |
| `cash_bank` | read, create, update, reconcile, export |
| `chart_of_account` | read, create, update, archive |
| `journal` | read, create, update, submit, approve, post, reverse, export |
| `accounting_period` | read, create, close, reopen |
| `posting_rule` | read, update |
| `cost_center` | read, create, update, archive |
| `credit_memo` | read, create, apply, void |
| `ar_write_off` | read, request, approve |
| `tax` | read, create, update, verify, export |
| `financial_report` | read, export |
| `service_ticket` | read, create, update, assign, resolve, close |
| `portal_account` | read, invite, revoke |
| `warranty_claim` | read, create, update, approve, reject, close |
| `asset` | read, create, update, assign, return, maintain, dispose, export |
| `document` | read, create, update, submit, approve, issue, void, download, signature_read, signature_request, signature_sign |
| `approval_rule` | read, configure |
| `budget` | read, create, update, submit, approve, revise, export |
| `work_plan` | read, create, update, approve |
| `investor` | read, create, update, archive |
| `capital_commitment` | read, create, update, approve |
| `capital_deposit` | read, create, verify, post |
| `fund_allocation` | read, create, submit, approve |
| `profit_distribution` | read, calculate, submit, approve, pay, export |
| `investor_report` | read, create, publish, export |
| `web_content` | read, create, update, publish, archive |
| `catalog` | read, create, update, publish, archive |
| `promotion` | read, create, update, publish, archive |
| `commerce_order` | read, update, process, cancel |
| `automation` | read, create, update, activate, execute, read_log |
| `whatsapp` | read, reply, manage_faq |
| `license` | read, create, activate, extend, revoke, read_key, manage_api |
| `integration` | read, configure, rotate_secret, test |
| `audit_log` | read, export |
| `organization` | create, read, update, delete |
| `member` | create, read, update, delete |
| `invitation` | create, cancel |
| `apiKey` | create, read, update, delete |

</details>

<details>
<summary><code>member</code> (Member)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |

</details>

<details>
<summary><code>operations_manager</code> (Operations Manager)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `dashboard` | read |
| `master_data` | read |
| `project` | read, create, update, assign, close, export |
| `task` | read, create, update, assign, submit, verify |
| `daily_report` | read, create, update, submit, verify |
| `kpi` | read, configure, evaluate, export |
| `budget` | read, create, update, submit, approve, export |
| `work_plan` | read, create, update, approve |
| `advance` | read, approve, reject |
| `settlement` | read, verify, approve, reject |
| `purchase_request` | read, approve, reject |
| `purchase_order` | read, approve |
| `purchase_return` | read, approve |
| `stock` | read |
| `stock_adjustment` | read, approve, post |
| `employee` | read |
| `asset` | read, create, update, assign, return, maintain, export |
| `asset_borrowing` | read, create, update, approve, issue, return, extend, mark_late, mark_lost, export |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>sales</code> (Sales)</summary>

| Resource | Actions |
| --- | --- |
| `portal_account` | read, invite, revoke |
| `ac` | read |
| `asset_borrowing` | read, create |
| `dashboard` | read |
| `master_data` | read |
| `customer` | read, create, update, archive, export |
| `lead` | read, create, update, assign, archive, export |
| `quotation` | read, create, update, submit, approve, reject, send, export |
| `sales_discount` | request, approve |
| `sales_order` | read, create, update, submit, approve, cancel, export |
| `sales_return` | read, create, update, submit, approve, cancel |
| `product` | read |
| `catalog` | read, create, update, publish, archive |
| `license` | read, create, activate, extend, revoke, read_key, manage_api |
| `apiKey` | create, read, update |
| `whatsapp` | read, reply |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>project_manager</code> (Project Manager)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `asset_borrowing` | read, create, approve |
| `dashboard` | read |
| `master_data` | read |
| `project` | read, create, update, assign, close, export, read_cost |
| `customer` | read |
| `service_ticket` | read, create, update, assign, resolve, close |
| `task` | read, create, update, assign, submit, verify |
| `daily_report` | read, create, update, submit, verify |
| `kpi` | read, evaluate |
| `settlement` | read, create, update, submit |
| `purchase_request` | read, create, submit |
| `work_plan` | read, create, update |
| `document` | read, create, submit, download, signature_read, signature_sign, signature_request |
| `asset` | read, assign |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>technician</code> (Technician)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `asset_borrowing` | read, create |
| `project` | read |
| `service_ticket` | read, update, resolve |
| `task` | read, update, submit |
| `daily_report` | read, create, update, submit |
| `advance` | read, create, update, submit |
| `settlement` | read, create, update, submit |
| `purchase_request` | read, create, submit |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>freelancer</code> (Freelancer)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `project` | read |
| `asset_borrowing` | read, create |
| `advance` | read, create |
| `task` | read, update, submit |
| `daily_report` | read, create, update, submit |
| `settlement` | read, create, update, submit |
| `document` | read, download, signature_read, signature_sign, signature_request |

</details>

<details>
<summary><code>purchasing</code> (Purchasing)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `dashboard` | read |
| `master_data` | read |
| `supplier` | read, create, update, archive, read_bank |
| `purchase_request` | read, create, update, submit |
| `purchase_order` | read, create, update, submit, send, export |
| `purchase_return` | read, create, update, submit, cancel |
| `product` | read, create, update, read_cost |
| `stock` | read |
| `stock_adjustment` | read, create, submit |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>warehouse</code> (Warehouse)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `product` | read |
| `stock` | read, receive, issue, transfer, export |
| `stock_adjustment` | read, create, submit |
| `purchase_return` | read, ship |
| `sales_return` | read, receive |
| `purchase_order` | read |
| `sales_order` | read |
| `asset_borrowing` | read, update, issue, return, extend, mark_late, mark_lost, export |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>finance</code> (Finance)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `dashboard` | read |
| `master_data` | read |
| `invoice` | read, create, update, issue, void, export |
| `receipt` | read, create, verify, post, reverse, export |
| `payment` | read, create, submit, approve, execute, reverse, export |
| `quotation` | read |
| `sales_order` | read |
| `sales_return` | read |
| `project` | read, read_cost |
| `budget` | read |
| `asset` | read |
| `bill` | read, create, record |
| `expense_claim` | read, create, update, submit, approve, reject, cancel |
| `cash_bank` | read, create, update, reconcile, export |
| `payroll_payment` | read, execute |
| `employee` | read, read_private |
| `payroll` | read, create, update, export |
| `financial_report` | read, export |
| `chart_of_account` | read, create, update, archive |
| `journal` | read, create, update, submit, approve, post, reverse, export |
| `accounting_period` | read, create, close |
| `posting_rule` | read, update |
| `cost_center` | read, create, update, archive |
| `credit_memo` | read, create, apply, void |
| `ar_write_off` | read, request, approve |
| `tax` | read, create, update, verify, export |
| `product` | read, read_cost |
| `supplier` | read, read_bank |
| `stock` | read |
| `license` | read |
| `investor` | read |
| `investor_report` | read, create, publish, export |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>hr</code> (Human Resource)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `dashboard` | read |
| `master_data` | read |
| `employee` | read, create, update, archive, export, read_private |
| `employment_contract` | read, create, update, approve, export |
| `attendance` | read, check_in, check_out, request_correction, approve_correction, export, record |
| `leave` | read, create, cancel, approve, reject |
| `overtime` | read, create, cancel, approve, reject |
| `schedule` | read, create, update, delete |
| `task` | read, create, update |
| `disciplinary_record` | read, create, update, approve |
| `payroll` | read, create, calculate, update, submit, export |
| `payslip` | read, publish, download |
| `document` | read, create, download, signature_read, signature_sign, signature_request |
| `member` | read |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>customer_service</code> (Customer Service)</summary>

| Resource | Actions |
| --- | --- |
| `portal_account` | read, invite, revoke |
| `ac` | read |
| `asset_borrowing` | read, create |
| `dashboard` | read |
| `customer` | read |
| `project` | read |
| `service_ticket` | read, create, update, assign, resolve, close |
| `warranty_claim` | read, create, update, approve, reject, close |
| `license` | read, read_key |
| `whatsapp` | read, reply |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

<details>
<summary><code>marketing</code> (Marketing)</summary>

| Resource | Actions |
| --- | --- |
| `ac` | read |
| `dashboard` | read |
| `web_content` | read, create, update, publish, archive |
| `catalog` | read, create, update, publish, archive |
| `promotion` | read, create, update, publish, archive |
| `commerce_order` | read, update, process, cancel |
| `automation` | read, read_log |
| `whatsapp` | read, manage_faq |
| `product` | read |
| `customer` | read |
| `document` | read, download, signature_read, signature_sign, signature_request |
| `self_service` | read_profile, update_profile, read_attendance, read_payslip, request_leave |

</details>

## Permissions per app role

App roles live on `user.role` and grant **no** organization permission; they only open a portal.

### `investor`

| Resource | Actions |
| --- | --- |
| `investor_portal` | read_commitment, read_deposit, read_allocation, read_distribution, read_report |

### `customer`

| Resource | Actions |
| --- | --- |
| `customer_portal` | read_project, read_document, read_invoice, create_ticket, read_ticket |

## Endpoints

817 routes across 22 modules, read from `apps/backend/src/app/*/controllers` and the shared code-numbering controller. 0 route(s) could not be resolved statically.

Columns: **Guard** is the check the route opts into; **Requirement** is every `resource:action` it needs (ALL must pass);
**Who** lists the organization roles whose grants satisfy it (`owner` holds every ERP statement except `warehouse:*`, which is app-admin-only).

### audit

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/admin/audit` | org member + permission | `audit_log:read` | `owner` |

### automation

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/automation/faq` | org member + permission | `whatsapp:read` | `owner`, `sales`, `customer_service`, `marketing` |
| POST | `/automation/faq` | org member + permission | `whatsapp:manage_faq` | `owner`, `marketing` |
| DELETE | `/automation/faq/:id` | org member + permission | `whatsapp:manage_faq` | `owner`, `marketing` |
| PUT | `/automation/faq/:id` | org member + permission | `whatsapp:manage_faq` | `owner`, `marketing` |
| GET | `/automation/outbox` | org member + permission | `automation:read_log` | `owner`, `marketing` |
| POST | `/automation/outbox/:id/retry` | org member + permission | `automation:execute` | `owner` |
| GET | `/automation/outbox/summary` | org member + permission | `automation:read_log` | `owner`, `marketing` |
| GET | `/automation/whatsapp/conversations` | org member + permission | `whatsapp:read` | `owner`, `sales`, `customer_service`, `marketing` |
| GET | `/automation/whatsapp/conversations/:id` | org member + permission | `whatsapp:read` | `owner`, `sales`, `customer_service`, `marketing` |
| POST | `/automation/whatsapp/conversations/:id/close` | org member + permission | `whatsapp:reply` | `owner`, `sales`, `customer_service` |
| POST | `/automation/whatsapp/conversations/:id/lead` | org member + permission | `whatsapp:reply` | `owner`, `sales`, `customer_service` |
| POST | `/automation/whatsapp/conversations/:id/reply` | org member + permission | `whatsapp:reply` | `owner`, `sales`, `customer_service` |
| POST | `/automation/whatsapp/conversations/:id/resume` | org member + permission | `whatsapp:reply` | `owner`, `sales`, `customer_service` |
| POST | `/automation/whatsapp/messages/:id/retry` | org member + permission | `whatsapp:reply` | `owner`, `sales`, `customer_service` |
| GET | `/automation/whatsapp/status` | org member + permission | `whatsapp:read` | `owner`, `sales`, `customer_service`, `marketing` |

### company

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/companies/branding` | no guard macro | - | - |
| GET | `/companies/letterheads` | org member | - | every organization member |
| POST | `/companies/letterheads` | org member + permission | `company:update` | `owner` |
| DELETE | `/companies/letterheads/:id` | org member + permission | `company:update` | `owner` |
| GET | `/companies/letterheads/:id` | org member | - | every organization member |
| PATCH | `/companies/letterheads/:id` | org member + permission | `company:update` | `owner` |
| PUT | `/companies/letterheads/:id/:kind` | org member + permission | `company:update` | `owner` |
| DELETE | `/companies/letterheads/:id/footer` | org member + permission | `company:update` | `owner` |
| GET | `/companies/profile` | org member | - | every organization member |
| PUT | `/companies/profile` | org member + permission | `company:update` | `owner` |
| DELETE | `/companies/profile/:kind` | org member + permission | `company:update` | `owner` |
| PUT | `/companies/profile/:kind` | org member + permission | `company:update` | `owner` |
| GET | `/companies/settings` | org member + permission | `company:read` | `owner` |
| PUT | `/companies/settings/:group/:key` | org member + permission | `company:update` | `owner` |

### customer

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/admin/customers/portal-accounts` | org member + permission | `portal_account:read` | `owner`, `sales`, `customer_service` |
| POST | `/admin/customers/portal-accounts` | org member + permission | `portal_account:invite` | `owner`, `sales`, `customer_service` |
| POST | `/admin/customers/portal-accounts/:id/resend` | org member + permission | `portal_account:invite` | `owner`, `sales`, `customer_service` |
| POST | `/admin/customers/portal-accounts/:id/revoke` | org member + permission | `portal_account:revoke` | `owner`, `sales`, `customer_service` |
| GET | `/customers/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/customers/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/customers/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/customers/companies` | org member + permission | `customer:read` | `owner`, `sales`, `project_manager`, `customer_service`, `marketing` |
| POST | `/customers/companies` | org member + permission | `customer:create` | `owner`, `sales` |
| GET | `/customers/companies/:id` | org member + permission | `customer:read` | `owner`, `sales`, `project_manager`, `customer_service`, `marketing` |
| PATCH | `/customers/companies/:id` | org member + permission | `customer:update` | `owner`, `sales` |
| POST | `/customers/companies/:id/activate` | org member + permission | `customer:archive` | `owner`, `sales` |
| POST | `/customers/companies/:id/addresses` | org member + permission | `customer:update` | `owner`, `sales` |
| DELETE | `/customers/companies/:id/addresses/:addressId` | org member + permission | `customer:update` | `owner`, `sales` |
| PATCH | `/customers/companies/:id/addresses/:addressId` | org member + permission | `customer:update` | `owner`, `sales` |
| POST | `/customers/companies/:id/deactivate` | org member + permission | `customer:archive` | `owner`, `sales` |
| GET | `/customers/people` | org member + permission | `customer:read` | `owner`, `sales`, `project_manager`, `customer_service`, `marketing` |
| POST | `/customers/people` | org member + permission | `customer:create` | `owner`, `sales` |
| GET | `/customers/people/:id` | org member + permission | `customer:read` | `owner`, `sales`, `project_manager`, `customer_service`, `marketing` |
| PATCH | `/customers/people/:id` | org member + permission | `customer:update` | `owner`, `sales` |
| POST | `/customers/people/:id/activate` | org member + permission | `customer:archive` | `owner`, `sales` |
| POST | `/customers/people/:id/addresses` | org member + permission | `customer:update` | `owner`, `sales` |
| DELETE | `/customers/people/:id/addresses/:addressId` | org member + permission | `customer:update` | `owner`, `sales` |
| PATCH | `/customers/people/:id/addresses/:addressId` | org member + permission | `customer:update` | `owner`, `sales` |
| POST | `/customers/people/:id/deactivate` | org member + permission | `customer:archive` | `owner`, `sales` |
| DELETE | `/customers/people/:id/photo` | org member + permission | `customer:update` | `owner`, `sales` |
| POST | `/customers/people/:id/photo` | org member + permission | `customer:update` | `owner`, `sales` |
| GET | `/customers/portal/v1/account` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/account/close` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/account/devices` | customer portal session | - | `customer` app role |
| DELETE | `/customers/portal/v1/account/devices/:id` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/account/devices/sign-out-others` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/account/members` | customer portal session | - | `customer` app role |
| DELETE | `/customers/portal/v1/account/members/:id` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/account/password` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/auth/login` | no guard macro | - | - |
| POST | `/customers/portal/v1/auth/logout` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/auth/password-reset` | no guard macro | - | - |
| POST | `/customers/portal/v1/auth/password-reset/confirm` | no guard macro | - | - |
| POST | `/customers/portal/v1/auth/register` | no guard macro | - | - |
| POST | `/customers/portal/v1/auth/verify-email` | no guard macro | - | - |
| POST | `/customers/portal/v1/auth/verify-email/resend` | no guard macro | - | - |
| GET | `/customers/portal/v1/badges` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/home` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/me` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/products` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/products/:id/warranty` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/projects` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/projects/:id` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/tickets` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/tickets` | customer portal session | - | `customer` app role |
| GET | `/customers/portal/v1/tickets/:id` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/tickets/:id/confirm` | customer portal session | - | `customer` app role |
| POST | `/customers/portal/v1/tickets/:id/messages` | customer portal session | - | `customer` app role |

### document

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/documents` | org member + permission | `document:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents` | org member + permission | `document:update` | `owner` |
| GET | `/documents/:id` | org member + permission | `document:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/:id/files` | org member + permission | `document:update` | `owner` |
| DELETE | `/documents/:id/files/:fileId` | org member + permission | `document:update` | `owner` |
| GET | `/documents/:id/files/:fileId/download` | org member + permission | `document:download` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/:id/shares` | org member + permission | `document:update` | `owner` |
| DELETE | `/documents/:id/shares/:shareId` | org member + permission | `document:update` | `owner` |
| GET | `/documents/:id/signatures` | org member + permission | `document:signature_read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/:id/void` | org member + permission | `document:update` | `owner` |
| GET | `/documents/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/documents/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/documents/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/documents/me/documents` | no guard macro | - | - |
| GET | `/documents/me/documents/:id/files/:fileId/download` | no guard macro | - | - |
| DELETE | `/documents/me/signature-image` | no guard macro | - | - |
| GET | `/documents/me/signature-image` | no guard macro | - | - |
| PUT | `/documents/me/signature-image` | no guard macro | - | - |
| GET | `/documents/me/signature-requests` | no guard macro | - | - |
| POST | `/documents/me/signature-requests/:id/decline` | no guard macro | - | - |
| POST | `/documents/me/signature-requests/:id/sign` | no guard macro | - | - |
| GET | `/documents/public/v1/shares/:token` | no guard macro | - | - |
| GET | `/documents/public/v1/shares/:token/file` | no guard macro | - | - |
| GET | `/documents/signatures` | org member + permission | `document:signature_read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| DELETE | `/documents/signatures/my-image` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| GET | `/documents/signatures/my-image` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| PUT | `/documents/signatures/my-image` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/signatures/requests` | org member + permission | `document:signature_request` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/signatures/requests/:id/cancel` | org member + permission | `document:signature_request` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/signatures/requests/:id/decline` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/signatures/requests/:id/sign` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| GET | `/documents/signatures/requests/:id/signed-pdf` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| PUT | `/documents/signatures/requests/:id/signed-pdf` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| GET | `/documents/signatures/requests/incoming` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| GET | `/documents/signatures/requests/outgoing` | org member + permission | `document:signature_request` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/signatures/user-images` | org member + permission | `document:signature_sign` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| GET | `/documents/templates` | org member + permission | `document:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `purchasing`, `warehouse`, `finance`, `hr`, `customer_service`, `marketing` |
| POST | `/documents/templates` | org member + permission | `document:update` | `owner` |

### finance

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/finance/advances` | org member + permission | `advance:read` | `owner`, `operations_manager`, `technician`, `freelancer` |
| POST | `/finance/advances` | org member + permission | `advance:create` | `owner`, `technician`, `freelancer` |
| GET | `/finance/advances/:id` | org member + permission | `advance:read` | `owner`, `operations_manager`, `technician`, `freelancer` |
| POST | `/finance/advances/:id/approve` | org member + permission | `advance:approve` | `owner`, `operations_manager` |
| POST | `/finance/advances/:id/cancel` | org member + permission | `advance:reject` | `owner`, `operations_manager` |
| POST | `/finance/advances/:id/submit` | org member + permission | `advance:submit` | `owner`, `technician` |
| GET | `/finance/ap/aging` | org member + permission | `bill:read` | `owner`, `finance` |
| POST | `/finance/ar/:invoiceId/write-off/approve` | org member + permission | `ar_write_off:approve` | `owner`, `finance` |
| POST | `/finance/ar/:invoiceId/write-off/cancel` | org member + permission | `ar_write_off:request` | `owner`, `finance` |
| POST | `/finance/ar/:invoiceId/write-off/request` | org member + permission | `ar_write_off:request` | `owner`, `finance` |
| GET | `/finance/ar/aging` | org member + permission | `payment:read` | `owner`, `finance` |
| GET | `/finance/ar/write-offs` | org member + permission | `ar_write_off:read` | `owner`, `finance` |
| POST | `/finance/bank-reconciliations/:id/items/:productId/match` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| GET | `/finance/cash-bank-accounts` | org member + permission | `cash_bank:read` | `owner`, `finance` |
| POST | `/finance/cash-bank-accounts` | org member + permission | `cash_bank:create` | `owner`, `finance` |
| GET | `/finance/cash-bank-accounts/:id` | org member + permission | `cash_bank:read` | `owner`, `finance` |
| PATCH | `/finance/cash-bank-accounts/:id` | org member + permission | `cash_bank:update` | `owner`, `finance` |
| PUT | `/finance/cash-bank-accounts/:id/statement-mapping` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| GET | `/finance/cash-bank-transactions` | org member + permission | `cash_bank:read` | `owner`, `finance` |
| POST | `/finance/cash-bank-transactions` | org member + permission | `cash_bank:create` | `owner`, `finance` |
| GET | `/finance/cash-bank-transactions/summary` | org member + permission | `cash_bank:read` | `owner`, `finance` |
| GET | `/finance/close/checklist` | org member + permission | `accounting_period:close` | `owner`, `finance` |
| GET | `/finance/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/finance/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/finance/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/finance/cost-centers` | org member + permission | `cost_center:read` | `owner`, `finance` |
| POST | `/finance/cost-centers` | org member + permission | `cost_center:create` | `owner`, `finance` |
| DELETE | `/finance/cost-centers/:id` | org member + permission | `cost_center:archive` | `owner`, `finance` |
| GET | `/finance/cost-centers/:id` | org member + permission | `cost_center:read` | `owner`, `finance` |
| PATCH | `/finance/cost-centers/:id` | org member + permission | `cost_center:update` | `owner`, `finance` |
| GET | `/finance/credit-memos` | org member + permission | `credit_memo:read` | `owner`, `finance` |
| POST | `/finance/credit-memos` | org member + permission | `credit_memo:create` | `owner`, `finance` |
| POST | `/finance/credit-memos/:id/apply` | org member + permission | `credit_memo:apply` | `owner`, `finance` |
| POST | `/finance/credit-memos/:id/void` | org member + permission | `credit_memo:void` | `owner`, `finance` |
| GET | `/finance/deferred-revenue` | org member + permission | `journal:read` | `owner`, `finance` |
| POST | `/finance/deferred-revenue/run` | org member + permission | `journal:post` | `owner`, `finance` |
| GET | `/finance/depreciations` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/finance/depreciations` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/finance/employee-bank-accounts` | org member + permission | `payroll:read` | `owner`, `finance`, `hr` |
| POST | `/finance/employee-bank-accounts` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| DELETE | `/finance/employee-bank-accounts/:id` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| PUT | `/finance/employee-bank-accounts/:id` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| GET | `/finance/expenses` | org member + permission | `expense_claim:read` | `owner`, `finance` |
| POST | `/finance/expenses` | org member + permission | `expense_claim:create` | `owner`, `finance` |
| GET | `/finance/expenses/:id` | org member + permission | `expense_claim:read` | `owner`, `finance` |
| PATCH | `/finance/expenses/:id` | org member + permission | `expense_claim:update` | `owner`, `finance` |
| POST | `/finance/expenses/:id/approve` | org member + permission | `expense_claim:approve` | `owner`, `finance` |
| POST | `/finance/expenses/:id/cancel` | org member + permission | `expense_claim:cancel` | `owner`, `finance` |
| POST | `/finance/expenses/:id/reject` | org member + permission | `expense_claim:reject` | `owner`, `finance` |
| POST | `/finance/expenses/:id/submit` | org member + permission | `expense_claim:submit` | `owner`, `finance` |
| GET | `/finance/fixed-assets` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/finance/fixed-assets/:itemId/capitalize` | org member + permission | `journal:post` | `owner`, `finance` |
| PATCH | `/finance/fixed-assets/:itemId/fiscal-group` | org member + permission | `journal:post` | `owner`, `finance` |
| POST | `/finance/fixed-assets/depreciation-runs` | org member + permission | `journal:post` | `owner`, `finance` |
| GET | `/finance/fixed-assets/fiscal-report` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/finance/gateway-settlements` | org member + permission | `cash_bank:create` | `owner`, `finance` |
| GET | `/finance/ledger/accounts` | org member + permission | `chart_of_account:read` | `owner`, `finance` |
| POST | `/finance/ledger/accounts` | org member + permission | `chart_of_account:create` | `owner`, `finance` |
| DELETE | `/finance/ledger/accounts/:id` | org member + permission | `chart_of_account:archive` | `owner`, `finance` |
| GET | `/finance/ledger/accounts/:id` | org member + permission | `chart_of_account:read` | `owner`, `finance` |
| PATCH | `/finance/ledger/accounts/:id` | org member + permission | `chart_of_account:update` | `owner`, `finance` |
| GET | `/finance/ledger/journal` | org member + permission | `journal:read` | `owner`, `finance` |
| POST | `/finance/ledger/journal` | org member + permission | `journal:create` | `owner`, `finance` |
| GET | `/finance/ledger/journal/:id` | org member + permission | `journal:read` | `owner`, `finance` |
| PATCH | `/finance/ledger/journal/:id` | org member + permission | `journal:update` | `owner`, `finance` |
| POST | `/finance/ledger/journal/:id/approve` | org member + permission | `journal:approve` | `owner`, `finance` |
| POST | `/finance/ledger/journal/:id/reject` | org member + permission | `journal:approve` | `owner`, `finance` |
| POST | `/finance/ledger/journal/:id/reverse` | org member + permission | `journal:reverse` | `owner`, `finance` |
| POST | `/finance/ledger/journal/:id/submit` | org member + permission | `journal:submit` | `owner`, `finance` |
| POST | `/finance/ledger/journal/:id/void` | org member + permission | `journal:update` | `owner`, `finance` |
| GET | `/finance/ledger/opening-balances` | org member + permission | `journal:read` | `owner`, `finance` |
| POST | `/finance/ledger/opening-balances` | org member + permission | `journal:create` | `owner`, `finance` |
| DELETE | `/finance/ledger/opening-balances/:id` | org member + permission | `journal:update` | `owner`, `finance` |
| PATCH | `/finance/ledger/opening-balances/:id` | org member + permission | `journal:update` | `owner`, `finance` |
| POST | `/finance/ledger/opening-balances/post` | org member + permission | `journal:post` | `owner`, `finance` |
| GET | `/finance/ledger/opening-balances/subledger` | org member + permission | `journal:read` | `owner`, `finance` |
| POST | `/finance/ledger/opening-balances/subledger/discard` | org member + permission | `journal:update` | `owner`, `finance` |
| POST | `/finance/ledger/opening-balances/subledger/import` | org member + permission | `journal:create` | `owner`, `finance` |
| GET | `/finance/ledger/opening-balances/subledger/template.csv` | org member + permission | `journal:read` | `owner`, `finance` |
| POST | `/finance/payments/:id/void-executed` | org member + permission | `payment:approve` | `owner`, `finance` |
| POST | `/finance/payroll/payments` | org member + permission | `payroll_payment:execute` | `owner`, `finance` |
| GET | `/finance/periods` | org member + permission | `accounting_period:read` | `owner`, `finance` |
| POST | `/finance/periods` | org member + permission | `accounting_period:create` | `owner`, `finance` |
| POST | `/finance/periods/:id/transition` | org member + permission | `accounting_period:close` | `owner`, `finance` |
| GET | `/finance/posting-rules` | org member + permission | `posting_rule:read` | `owner`, `finance` |
| POST | `/finance/posting-rules` | org member + permission | `posting_rule:update` | `owner`, `finance` |
| DELETE | `/finance/posting-rules/:id` | org member + permission | `posting_rule:update` | `owner`, `finance` |
| PATCH | `/finance/posting-rules/:id` | org member + permission | `posting_rule:update` | `owner`, `finance` |
| POST | `/finance/project-budgets/:id/activate` | org member + permission | `journal:approve` | `owner`, `finance` |
| PUT | `/finance/project-budgets/:id/lines` | org member + permission | `journal:approve` | `owner`, `finance` |
| PATCH | `/finance/project-budgets/:id/mode` | org member + permission | `journal:approve` | `owner`, `finance` |
| GET | `/finance/project-budgets/check` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| GET | `/finance/project-budgets/projects/:projectId` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| POST | `/finance/project-budgets/projects/:projectId` | org member + permission | `journal:approve` | `owner`, `finance` |
| GET | `/finance/project-budgets/projects/:projectId/report` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| GET | `/finance/reconciliations` | org member + permission | `cash_bank:read` | `owner`, `finance` |
| POST | `/finance/reconciliations` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| GET | `/finance/reconciliations/:id` | org member + permission | `cash_bank:read` | `owner`, `finance` |
| POST | `/finance/reconciliations/:id/auto-match` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| POST | `/finance/reconciliations/:id/close` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| POST | `/finance/reconciliations/:id/items` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| POST | `/finance/reconciliations/:id/items/:itemId/transaction` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| POST | `/finance/reconciliations/:id/reconcile` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| POST | `/finance/reconciliations/:id/statement` | org member + permission | `cash_bank:reconcile` | `owner`, `finance` |
| GET | `/finance/reports/archives` | org member + permission | `financial_report:read` | `owner`, `finance` |
| POST | `/finance/reports/archives` | org member + permission | `accounting_period:close` | `owner`, `finance` |
| GET | `/finance/reports/archives/:id` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/balance-sheet` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/balance-sheet.csv` | org member + permission | `financial_report:export` | `owner`, `finance` |
| GET | `/finance/reports/cash-flow` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/cash-flow.csv` | org member + permission | `financial_report:export` | `owner`, `finance` |
| GET | `/finance/reports/cash-forecast` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/cash-forecast/lines` | org member + permission | `financial_report:read` | `owner`, `finance` |
| POST | `/finance/reports/cash-forecast/lines` | org member + permission | `cash_bank:create` | `owner`, `finance` |
| DELETE | `/finance/reports/cash-forecast/lines/:id` | org member + permission | `cash_bank:create` | `owner`, `finance` |
| GET | `/finance/reports/cost-center-pl` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/general-ledger` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/management-pack` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/management-pack.xlsx` | org member + permission | `financial_report:export` | `owner`, `finance` |
| GET | `/finance/reports/profit-and-loss` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/profit-and-loss.csv` | org member + permission | `financial_report:export` | `owner`, `finance` |
| GET | `/finance/reports/profitability` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/project-costing` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/project-costing/:projectId` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/ratios` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/statements` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/reports/trial-balance` | org member + permission | `financial_report:read` | `owner`, `finance` |
| GET | `/finance/settlements` | org member + permission | `settlement:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer` |
| POST | `/finance/settlements` | org member + permission | `settlement:create` | `owner`, `project_manager`, `technician`, `freelancer` |
| GET | `/finance/settlements/:id` | org member + permission | `settlement:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer` |
| POST | `/finance/settlements/:id/approve` | org member + permission | `settlement:approve` | `owner`, `operations_manager` |
| POST | `/finance/settlements/:id/cancel` | org member + permission | `settlement:update` | `owner`, `project_manager`, `technician`, `freelancer` |
| POST | `/finance/settlements/:id/reject` | org member + permission | `settlement:reject` | `owner`, `operations_manager` |
| POST | `/finance/settlements/:id/submit` | org member + permission | `settlement:submit` | `owner`, `project_manager`, `technician`, `freelancer` |
| POST | `/finance/settlements/:id/verify` | org member + permission | `settlement:verify` | `owner`, `operations_manager` |
| GET | `/finance/supplier-bills` | org member + permission | `bill:read` | `owner`, `finance` |
| POST | `/finance/supplier-bills` | org member + permission | `bill:create` | `owner`, `finance` |
| GET | `/finance/supplier-bills/:id` | org member + permission | `bill:read` | `owner`, `finance` |
| POST | `/finance/supplier-bills/:id/cancel` | org member + permission | `bill:create` | `owner`, `finance` |
| POST | `/finance/supplier-bills/:id/record` | org member + permission | `bill:record` | `owner`, `finance` |
| GET | `/finance/supplier-bills/billable-orders` | org member + permission | `bill:create` | `owner`, `finance` |
| POST | `/finance/supplier-bills/from-purchase-order` | org member + permission | `bill:create` | `owner`, `finance` |
| POST | `/finance/tax/payments` | org member + permission | `cash_bank:create` | `owner`, `finance` |
| POST | `/finance/tax/ppn-settlements` | org member + permission | `journal:post` | `owner`, `finance` |

### human-resource

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/human-resources/active-employees` | org member + permission | `employee:read` | `owner`, `operations_manager`, `finance`, `hr` |
| GET | `/human-resources/attendances` | org member + permission | `attendance:read` | `owner`, `hr` |
| POST | `/human-resources/attendances` | org member + permission | `attendance:record` | `owner`, `hr` |
| DELETE | `/human-resources/attendances/:id` | org member + permission | `attendance:record` | `owner`, `hr` |
| PUT | `/human-resources/attendances/:id` | org member + permission | `attendance:record` | `owner`, `hr` |
| GET | `/human-resources/attendances/day` | org member + permission | `attendance:read` | `owner`, `hr` |
| PUT | `/human-resources/attendances/day` | org member + permission | `attendance:record` | `owner`, `hr` |
| POST | `/human-resources/attendances/import` | org member + permission | `attendance:record` | `owner`, `hr` |
| GET | `/human-resources/attendances/month` | org member + permission | `attendance:read` | `owner`, `hr` |
| GET | `/human-resources/attendances/template` | org member + permission | `attendance:record` | `owner`, `hr` |
| GET | `/human-resources/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/human-resources/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/human-resources/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/human-resources/employee-tasks` | org member + permission | `task:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| POST | `/human-resources/employee-tasks` | org member + permission | `task:create` | `owner`, `operations_manager`, `project_manager`, `hr` |
| DELETE | `/human-resources/employee-tasks/:id` | org member + permission | `task:update` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| PUT | `/human-resources/employee-tasks/:id` | org member + permission | `task:update` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| POST | `/human-resources/employee-tasks/:id/status` | org member + permission | `task:update` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| GET | `/human-resources/employees` | org member + permission | `employee:read` | `owner`, `operations_manager`, `finance`, `hr` |
| POST | `/human-resources/employees` | org member + permission | `employee:create` | `owner`, `hr` |
| DELETE | `/human-resources/employees/:id` | org member + permission | `employee:archive` | `owner`, `hr` |
| GET | `/human-resources/employees/:id` | org member + permission | `employee:read` | `owner`, `operations_manager`, `finance`, `hr` |
| PATCH | `/human-resources/employees/:id` | org member + permission | `employee:update` | `owner`, `hr` |
| GET | `/human-resources/employees/:id/documents` | org member + permission | `employee:read` | `owner`, `operations_manager`, `finance`, `hr` |
| POST | `/human-resources/employees/:id/documents` | org member + permission | `employee:update` | `owner`, `hr` |
| POST | `/human-resources/employees/:id/documents/:documentId/files` | org member + permission | `employee:update` | `owner`, `hr` |
| GET | `/human-resources/employees/:id/documents/:documentId/files/:fileId/download` | org member + permission | `employee:read` | `owner`, `operations_manager`, `finance`, `hr` |
| POST | `/human-resources/employees/:id/documents/:documentId/regenerate-pdf` | org member + permission | `employee:update` | `owner`, `hr` |
| POST | `/human-resources/employees/:id/documents/:documentId/void` | org member + permission | `employee:update` | `owner`, `hr` |
| GET | `/human-resources/employees/:id/salaries` | org member + permission | `payroll:read` | `owner`, `finance`, `hr` |
| POST | `/human-resources/employees/:id/salaries` | org member + permission | `payroll:create` | `owner`, `finance`, `hr` |
| GET | `/human-resources/employees/picker` | org member + permission | `employee:read` | `owner`, `operations_manager`, `finance`, `hr` |
| GET | `/human-resources/leave` | org member + permission | `leave:read` | `owner`, `hr` |
| POST | `/human-resources/leave` | org member + permission | `leave:create` | `owner`, `hr` |
| GET | `/human-resources/leave-types` | org member + permission | `leave:read` | `owner`, `hr` |
| PUT | `/human-resources/leave/:id` | org member + permission | `leave:create` | `owner`, `hr` |
| POST | `/human-resources/leave/:id/approve` | org member + permission | `leave:approve` | `owner`, `hr` |
| POST | `/human-resources/leave/:id/cancel` | org member + permission | `leave:cancel` | `owner`, `hr` |
| POST | `/human-resources/leave/:id/reject` | org member + permission | `leave:reject` | `owner`, `hr` |
| GET | `/human-resources/leave/balances` | org member + permission | `leave:read` | `owner`, `hr` |
| GET | `/human-resources/me/access` | session | - | any signed-in user |
| GET | `/human-resources/me/attendance` | no guard macro | - | - |
| POST | `/human-resources/me/attendance/check-in` | no guard macro | - | - |
| POST | `/human-resources/me/attendance/check-out` | no guard macro | - | - |
| GET | `/human-resources/me/attendance/month` | no guard macro | - | - |
| GET | `/human-resources/me/attendance/today` | no guard macro | - | - |
| GET | `/human-resources/me/context` | no guard macro | - | - |
| GET | `/human-resources/me/leave` | no guard macro | - | - |
| POST | `/human-resources/me/leave` | no guard macro | - | - |
| GET | `/human-resources/me/leave-balances` | no guard macro | - | - |
| GET | `/human-resources/me/leave-types` | no guard macro | - | - |
| POST | `/human-resources/me/leave/:id/cancel` | no guard macro | - | - |
| GET | `/human-resources/me/overtime` | no guard macro | - | - |
| POST | `/human-resources/me/overtime` | no guard macro | - | - |
| GET | `/human-resources/me/profile` | no guard macro | - | - |
| PATCH | `/human-resources/me/profile` | no guard macro | - | - |
| GET | `/human-resources/me/schedule` | no guard macro | - | - |
| GET | `/human-resources/me/tasks` | no guard macro | - | - |
| POST | `/human-resources/me/tasks/:id/status` | no guard macro | - | - |
| GET | `/human-resources/overtime` | org member + permission | `overtime:read` | `owner`, `hr` |
| POST | `/human-resources/overtime` | org member + permission | `overtime:create` | `owner`, `hr` |
| PUT | `/human-resources/overtime/:id` | org member + permission | `overtime:create` | `owner`, `hr` |
| POST | `/human-resources/overtime/:id/approve` | org member + permission | `overtime:approve` | `owner`, `hr` |
| POST | `/human-resources/overtime/:id/cancel` | org member + permission | `overtime:cancel` | `owner`, `hr` |
| POST | `/human-resources/overtime/:id/reject` | org member + permission | `overtime:reject` | `owner`, `hr` |
| GET | `/human-resources/payroll-settings` | app admin | - | app admin |
| PUT | `/human-resources/payroll-settings` | app admin | - | app admin |
| GET | `/human-resources/payroll-settings/statutory` | app admin | - | app admin |
| PUT | `/human-resources/payroll-settings/statutory` | app admin | - | app admin |
| GET | `/human-resources/public/v1/render/employment-agreements/:id` | no guard macro | - | - |
| GET | `/human-resources/public/v1/render/payslips/:id` | no guard macro | - | - |
| DELETE | `/human-resources/salaries/:id` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| PUT | `/human-resources/salaries/:id` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| GET | `/human-resources/salary-records` | org member + permission | `payroll:read` | `owner`, `finance`, `hr` |
| PUT | `/human-resources/salary-records` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| DELETE | `/human-resources/salary-records/:id` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| GET | `/human-resources/salary-records/:id/payslip` | org member + permission | `payroll:read` | `owner`, `finance`, `hr` |
| POST | `/human-resources/salary-records/:id/payslip/regenerate` | org member + permission | `payroll:update` | `owner`, `finance`, `hr` |
| POST | `/human-resources/salary-records/approve` | org member + permission | `payroll:approve` | `owner` |
| GET | `/human-resources/salary-records/bp21.xml` | org member + permission | `payroll:export` | `owner`, `finance`, `hr` |
| POST | `/human-resources/salary-records/generate` | org member + permission | `payroll:create` | `owner`, `finance`, `hr` |
| POST | `/human-resources/salary-records/import` | org member + permission | `payroll:create` | `owner`, `finance`, `hr` |
| GET | `/human-resources/salary-records/payslips.zip` | org member + permission | `payroll:read` | `owner`, `finance`, `hr` |
| POST | `/human-resources/salary-records/recalculate` | org member + permission | `payroll:calculate` | `owner`, `hr` |
| GET | `/human-resources/salary-records/template` | org member + permission | `payroll:read` | `owner`, `finance`, `hr` |
| POST | `/human-resources/schedules` | org member + permission | `schedule:create` | `owner`, `hr` |
| DELETE | `/human-resources/schedules/:id` | org member + permission | `schedule:delete` | `owner`, `hr` |
| PUT | `/human-resources/schedules/:id` | org member + permission | `schedule:update` | `owner`, `hr` |
| POST | `/human-resources/schedules/fill` | org member + permission | `schedule:create` | `owner`, `hr` |
| GET | `/human-resources/schedules/week` | org member + permission | `schedule:read` | `owner`, `hr` |
| GET | `/users/me/payslips` | session | - | any signed-in user |
| GET | `/users/me/payslips/:id/download` | session | - | any signed-in user |

### inventory

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/inventory/borrowing-requests` | org member + permission | `asset_borrowing:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `warehouse`, `customer_service` |
| POST | `/inventory/borrowing-requests` | org member + permission | `asset_borrowing:create` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `customer_service` |
| GET | `/inventory/borrowing-requests/:id` | org member + permission | `asset_borrowing:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `warehouse`, `customer_service` |
| POST | `/inventory/borrowing-requests/:id/approve` | org member + permission | `asset_borrowing:approve` | `owner`, `operations_manager`, `project_manager` |
| POST | `/inventory/borrowing-requests/:id/cancel` | org member + permission | `asset_borrowing:create` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `customer_service` |
| POST | `/inventory/borrowing-requests/:id/extend` | org member + permission | `asset_borrowing:extend` | `owner`, `operations_manager`, `warehouse` |
| POST | `/inventory/borrowing-requests/:id/issue` | org member + permission | `asset_borrowing:issue` | `owner`, `operations_manager`, `warehouse` |
| POST | `/inventory/borrowing-requests/:id/reject` | org member + permission | `asset_borrowing:approve` | `owner`, `operations_manager`, `project_manager` |
| POST | `/inventory/borrowing-requests/:id/submit` | org member + permission | `asset_borrowing:create` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `customer_service` |
| GET | `/inventory/borrowings` | org member + permission | `asset_borrowing:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `warehouse`, `customer_service` |
| GET | `/inventory/borrowings/:id` | org member + permission | `asset_borrowing:read` | `owner`, `operations_manager`, `sales`, `project_manager`, `technician`, `freelancer`, `warehouse`, `customer_service` |
| POST | `/inventory/borrowings/:id/close` | org member + permission | `asset_borrowing:update` | `owner`, `operations_manager`, `warehouse` |
| POST | `/inventory/borrowings/:id/extend` | org member + permission | `asset_borrowing:extend` | `owner`, `operations_manager`, `warehouse` |
| POST | `/inventory/borrowings/:id/mark-lost` | org member + permission | `asset_borrowing:mark_lost` | `owner`, `operations_manager`, `warehouse` |
| POST | `/inventory/borrowings/:id/return` | org member + permission | `asset_borrowing:return` | `owner`, `operations_manager`, `warehouse` |
| GET | `/inventory/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/inventory/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/inventory/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/inventory/disposals` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| GET | `/inventory/disposals/:id` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/disposals/:id/approve` | org member + permission | `asset:dispose` | `owner` |
| POST | `/inventory/disposals/:id/cancel` | org member + permission | `asset:dispose` | `owner` |
| POST | `/inventory/disposals/:id/execute` | org member + permission | `asset:dispose` | `owner` |
| GET | `/inventory/item-categories` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/item-categories` | org member + permission | `asset:create` | `owner`, `operations_manager` |
| DELETE | `/inventory/item-categories/:id` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/item-categories/:id` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| PATCH | `/inventory/item-categories/:id` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/items` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/items` | org member + permission | `asset:create` | `owner`, `operations_manager` |
| DELETE | `/inventory/items/:id` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| PATCH | `/inventory/items/:id` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/items/:id/condition-checks` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/items/:id/condition-checks` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| POST | `/inventory/items/:id/deactivate` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| POST | `/inventory/items/:id/disposals` | org member + permission | `asset:dispose` | `owner` |
| GET | `/inventory/items/:id/documents` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/items/:id/documents` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/items/:id/history` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| DELETE | `/inventory/items/:id/image` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| PUT | `/inventory/items/:id/image` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/items/:id/images` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/items/:id/images` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| DELETE | `/inventory/items/:id/images/:imageId` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| PATCH | `/inventory/items/:id/images/:imageId` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| PUT | `/inventory/items/:id/images/order` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/items/:id/maintenances` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/items/:id/maintenances` | org member + permission | `asset:maintain` | `owner`, `operations_manager` |
| GET | `/inventory/items/:id/movements` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/items/:id/movements` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| POST | `/inventory/items/:id/place` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| POST | `/inventory/items/:id/reactivate` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| POST | `/inventory/items/:id/transfer` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/items/kinds` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| GET | `/inventory/tool-sets` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| POST | `/inventory/tool-sets` | org member + permission | `asset:create` | `owner`, `operations_manager` |
| DELETE | `/inventory/tool-sets/:id` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/inventory/tool-sets/:id` | org member + permission | `asset:read` | `owner`, `operations_manager`, `project_manager`, `finance` |
| PATCH | `/inventory/tool-sets/:id` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| POST | `/inventory/tool-sets/:id/items` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| DELETE | `/inventory/tool-sets/:id/items/:rowId` | org member + permission | `asset:update` | `owner`, `operations_manager` |
| GET | `/products/:id/units` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |
| POST | `/products/:id/units` | org member + permission | `product:update` | `owner`, `purchasing` |
| PATCH | `/products/:id/units/:unitId` | org member + permission | `product:update` | `owner`, `purchasing` |
| GET | `/stock/adjustments` | org member + permission | `stock_adjustment:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| POST | `/stock/adjustments` | org member + permission | `stock_adjustment:create` | `owner`, `purchasing`, `warehouse` |
| GET | `/stock/adjustments/:id` | org member + permission | `stock_adjustment:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| POST | `/stock/adjustments/:id/approve` | org member + permission | `stock_adjustment:approve` | `owner`, `operations_manager` |
| POST | `/stock/adjustments/:id/cancel` | org member + permission | `stock_adjustment:create` | `owner`, `purchasing`, `warehouse` |
| PUT | `/stock/adjustments/:id/lines` | org member + permission | `stock_adjustment:create` | `owner`, `purchasing`, `warehouse` |
| POST | `/stock/adjustments/:id/post` | org member + permission | `stock_adjustment:post` | `owner`, `operations_manager` |
| POST | `/stock/adjustments/:id/reject` | org member + permission | `stock_adjustment:approve` | `owner`, `operations_manager` |
| POST | `/stock/adjustments/:id/submit` | org member + permission | `stock_adjustment:create` | `owner`, `purchasing`, `warehouse` |
| GET | `/stock/balances` | org member + permission | `stock:read` | `owner`, `operations_manager`, `purchasing`, `warehouse`, `finance` |
| POST | `/stock/balances/recompute` | org member + permission | `stock_adjustment:post` | `owner`, `operations_manager` |
| POST | `/stock/issues` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| GET | `/stock/movements` | org member + permission | `stock:read` | `owner`, `operations_manager`, `purchasing`, `warehouse`, `finance` |
| POST | `/stock/movements/:id/reverse` | org member + permission | `stock_adjustment:post` | `owner`, `operations_manager` |
| GET | `/stock/project-options` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| POST | `/stock/receipts` | org member + permission | `stock:receive` | `owner`, `warehouse` |
| GET | `/stock/valuation` | org member + permission | `stock:read` `product:read_cost` | `owner`, `purchasing`, `finance` |

### location

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/locations/districts` | no guard macro | - | - |
| GET | `/locations/districts/:id` | no guard macro | - | - |
| GET | `/locations/districts/:id/villages` | no guard macro | - | - |
| GET | `/locations/provinces` | no guard macro | - | - |
| GET | `/locations/provinces/:id` | no guard macro | - | - |
| GET | `/locations/regencies` | no guard macro | - | - |
| GET | `/locations/regencies/:id` | no guard macro | - | - |
| GET | `/locations/regencies/:id/districts` | no guard macro | - | - |
| GET | `/locations/villages` | no guard macro | - | - |
| GET | `/locations/villages/:id` | no guard macro | - | - |

### notification

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | session | - | any signed-in user |
| PATCH | `/notifications/:id/read` | session | - | any signed-in user |
| POST | `/notifications/read-all` | session | - | any signed-in user |
| GET | `/notifications/unread-count` | session | - | any signed-in user |

### organization

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/organizations` | org member + permission | `organization:read` | `owner` |
| POST | `/organizations` | session + app admin | - | app admin |
| DELETE | `/organizations/:organizationId` | org member + permission | `organization:delete` | `owner` |
| GET | `/organizations/:organizationId` | org member + permission | `organization:read` | `owner` |
| PATCH | `/organizations/:organizationId` | org member + permission | `organization:update` | `owner` |
| DELETE | `/organizations/:organizationId/image-profile` | org member + permission | `organization:update` | `owner` |
| GET | `/organizations/:organizationId/image-profile` | org member + permission | `organization:read` | `owner` |
| POST | `/organizations/:organizationId/image-profile` | org member + permission | `organization:update` | `owner` |
| GET | `/organizations/:organizationId/invitations` | org member + permission | `member:read` | `owner`, `hr` |
| POST | `/organizations/:organizationId/invitations` | org member + permission | `invitation:create` | `owner` |
| DELETE | `/organizations/:organizationId/invitations/:invitationId` | org member + permission | `invitation:cancel` | `owner` |
| POST | `/organizations/:organizationId/invitations/:invitationId/cancel` | org member + permission | `invitation:cancel` | `owner` |
| POST | `/organizations/:organizationId/invitations/:invitationId/resend` | org member + permission | `invitation:create` | `owner` |
| GET | `/organizations/:organizationId/members` | org member + permission | `member:read` | `owner`, `hr` |
| POST | `/organizations/:organizationId/members` | org member + permission | `member:create` | `owner` |
| DELETE | `/organizations/:organizationId/members/:memberId` | org member + permission | `member:delete` | `owner` |
| PATCH | `/organizations/:organizationId/members/:memberId` | org member + permission | `member:update` | `owner` |
| POST | `/organizations/:organizationId/restore` | org member + permission | `organization:delete` | `owner` |
| GET | `/organizations/mine` | session | - | any signed-in user |
| GET | `/organizations/template` | org member + permission | `member:read` | `owner`, `hr` |

### payment

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/admin/payments/gateways` | org member + permission | `payment_gateway:read` | `owner` |
| POST | `/admin/payments/gateways` | org member + permission | `payment_gateway:update` | `owner` |
| PATCH | `/admin/payments/gateways/:id` | org member + permission | `payment_gateway:update` | `owner` |
| POST | `/admin/payments/gateways/:id/default` | org member + permission | `payment_gateway:update` | `owner` |
| GET | `/payments` | org member + permission | `payment:read` | `owner`, `finance` |
| POST | `/payments` | org member + permission | `payment:create` | `owner`, `finance` |
| GET | `/payments/:id` | org member + permission | `payment:read` | `owner`, `finance` |
| PUT | `/payments/:id/allocations` | org member + permission | `payment:create` | `owner`, `finance` |
| POST | `/payments/:id/approve` | org member + permission | `payment:approve` | `owner`, `finance` |
| POST | `/payments/:id/execute` | org member + permission | `payment:execute` | `owner`, `finance` |
| POST | `/payments/:id/submit` | org member + permission | `payment:submit` | `owner`, `finance` |
| POST | `/payments/:id/void` | org member + permission | `payment:approve` | `owner`, `finance` |
| GET | `/payments/checkouts/invoices/:id` | org member + permission | `invoice:read` | `owner`, `finance` |
| POST | `/payments/checkouts/invoices/:id` | org member + permission | `receipt:create` | `owner`, `finance` |
| GET | `/payments/checkouts/status` | org member + permission | `invoice:read` | `owner`, `finance` |
| GET | `/payments/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/payments/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/payments/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |

### procurement

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/procurement/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/procurement/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/procurement/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/procurement/goods-receipts` | org member + permission | `stock:read` | `owner`, `operations_manager`, `purchasing`, `warehouse`, `finance` |
| POST | `/procurement/goods-receipts` | org member + permission | `stock:receive` | `owner`, `warehouse` |
| GET | `/procurement/goods-receipts/:id` | org member + permission | `stock:read` | `owner`, `operations_manager`, `purchasing`, `warehouse`, `finance` |
| GET | `/procurement/goods-receipts/receivable-orders` | org member + permission | `stock:receive` | `owner`, `warehouse` |
| GET | `/procurement/goods-receipts/warehouses` | org member + permission | `stock:receive` | `owner`, `warehouse` |
| GET | `/procurement/purchase-orders` | org member + permission | `purchase_order:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| POST | `/procurement/purchase-orders` | org member + permission | `purchase_order:create` | `owner`, `purchasing` |
| GET | `/procurement/purchase-orders/:id` | org member + permission | `purchase_order:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| PATCH | `/procurement/purchase-orders/:id` | org member + permission | `purchase_order:update` | `owner`, `purchasing` |
| POST | `/procurement/purchase-orders/:id/cancel` | org member + permission | `purchase_order:cancel` | `owner` |
| POST | `/procurement/purchase-orders/:id/close` | org member + permission | `purchase_order:cancel` | `owner` |
| POST | `/procurement/purchase-orders/:id/decision` | org member + permission | `purchase_order:approve` | `owner`, `operations_manager` |
| POST | `/procurement/purchase-orders/:id/submit` | org member + permission | `purchase_order:submit` | `owner`, `purchasing` |
| GET | `/procurement/purchase-requests` | org member + permission | `purchase_request:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `purchasing` |
| POST | `/procurement/purchase-requests` | org member + permission | `purchase_request:create` | `owner`, `project_manager`, `technician`, `purchasing` |
| GET | `/procurement/purchase-requests/:id` | org member + permission | `purchase_request:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `purchasing` |
| PATCH | `/procurement/purchase-requests/:id` | org member + permission | `purchase_request:create` | `owner`, `project_manager`, `technician`, `purchasing` |
| POST | `/procurement/purchase-requests/:id/approve` | org member + permission | `purchase_request:approve` | `owner`, `operations_manager` |
| POST | `/procurement/purchase-requests/:id/cancel` | org member + permission | `purchase_request:create` | `owner`, `project_manager`, `technician`, `purchasing` |
| POST | `/procurement/purchase-requests/:id/reject` | org member + permission | `purchase_request:reject` | `owner`, `operations_manager` |
| POST | `/procurement/purchase-requests/:id/submit` | org member + permission | `purchase_request:submit` | `owner`, `project_manager`, `technician`, `purchasing` |
| GET | `/procurement/purchase-requests/items` | org member + permission | `purchase_request:create` | `owner`, `project_manager`, `technician`, `purchasing` |
| GET | `/procurement/purchase-requests/open-lines` | org member + permission | `purchase_request:read` `purchase_order:create` | `owner`, `purchasing` |
| GET | `/procurement/purchase-returns` | org member + permission | `purchase_return:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| POST | `/procurement/purchase-returns` | org member + permission | `purchase_return:create` | `owner`, `purchasing` |
| GET | `/procurement/purchase-returns/:id` | org member + permission | `purchase_return:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| PATCH | `/procurement/purchase-returns/:id` | org member + permission | `purchase_return:update` | `owner`, `purchasing` |
| POST | `/procurement/purchase-returns/:id/cancel` | org member + permission | `purchase_return:cancel` | `owner`, `purchasing` |
| POST | `/procurement/purchase-returns/:id/decision` | org member + permission | `purchase_return:approve` | `owner`, `operations_manager` |
| POST | `/procurement/purchase-returns/:id/ship` | org member + permission | `purchase_return:ship` | `owner`, `warehouse` |
| POST | `/procurement/purchase-returns/:id/submit` | org member + permission | `purchase_return:submit` | `owner`, `purchasing` |
| GET | `/procurement/purchase-returns/returnable-receipts` | org member + permission | `purchase_return:create` | `owner`, `purchasing` |
| GET | `/procurement/purchase-term-templates` | org member + permission | `purchase_order:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| POST | `/procurement/purchase-term-templates` | org member + permission | `purchase_order:update` | `owner`, `purchasing` |
| DELETE | `/procurement/purchase-term-templates/:id` | org member + permission | `purchase_order:update` | `owner`, `purchasing` |
| GET | `/procurement/purchase-term-templates/:id` | org member + permission | `purchase_order:read` | `owner`, `operations_manager`, `purchasing`, `warehouse` |
| PUT | `/procurement/purchase-term-templates/:id` | org member + permission | `purchase_order:update` | `owner`, `purchasing` |

### product

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/product-categories` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |
| POST | `/product-categories` | org member + permission | `product:create` | `owner`, `purchasing` |
| DELETE | `/product-categories/:id` | org member + permission | `product:archive` | `owner` |
| PATCH | `/product-categories/:id` | org member + permission | `product:update` | `owner`, `purchasing` |
| GET | `/product-listings` | org member + permission | `catalog:read` | `owner`, `sales`, `marketing` |
| DELETE | `/product-listings/:id` | org member + permission | `catalog:archive` | `owner`, `sales`, `marketing` |
| PUT | `/product-listings/:id` | org member + permission | `catalog:update` | `owner`, `sales`, `marketing` |
| POST | `/product-listings/:id/publish` | org member + permission | `catalog:publish` | `owner`, `sales`, `marketing` |
| GET | `/products` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |
| POST | `/products` | org member + permission | `product:create` | `owner`, `purchasing` |
| DELETE | `/products/:id` | org member + permission | `product:archive` | `owner` |
| GET | `/products/:id` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |
| PATCH | `/products/:id` | org member + permission | `product:update` | `owner`, `purchasing` |
| GET | `/products/:id/components` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |
| PUT | `/products/:id/components` | org member + permission | `product:update` | `owner`, `purchasing` |
| DELETE | `/products/:id/image` | org member + permission | `product:update` | `owner`, `purchasing` |
| PUT | `/products/:id/image` | org member + permission | `product:update` | `owner`, `purchasing` |
| GET | `/products/:id/images` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |
| POST | `/products/:id/images` | org member + permission | `product:update` | `owner`, `purchasing` |
| DELETE | `/products/:id/images/:imageId` | org member + permission | `product:update` | `owner`, `purchasing` |
| PATCH | `/products/:id/images/:imageId` | org member + permission | `product:update` | `owner`, `purchasing` |
| PUT | `/products/:id/images/order` | org member + permission | `product:update` | `owner`, `purchasing` |
| GET | `/products/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/products/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/products/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| POST | `/products/public/v1/catalog/cart/price` | public API key | - | - |
| GET | `/products/public/v1/catalog/categories` | public API key | - | - |
| GET | `/products/public/v1/catalog/facets` | public API key | - | - |
| GET | `/products/public/v1/catalog/pricing` | public API key | - | - |
| GET | `/products/public/v1/catalog/products` | public API key | - | - |
| GET | `/products/public/v1/catalog/products/:slug` | public API key | - | - |
| GET | `/products/public/v1/catalog/products/:slug/image` | no guard macro | - | - |
| GET | `/products/public/v1/catalog/search` | public API key | - | - |
| GET | `/products/public/v1/catalog/solutions` | public API key | - | - |
| GET | `/products/public/v1/catalog/stock` | public API key | - | - |
| GET | `/products/ranges` | org member + permission | `product:read` | `owner`, `sales`, `purchasing`, `warehouse`, `finance`, `marketing` |

### project

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/projects` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| POST | `/projects` | org member + permission | `project:create` | `owner`, `operations_manager`, `project_manager` |
| GET | `/projects/:id` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| PUT | `/projects/:id` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |
| GET | `/projects/:id/basts` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| POST | `/projects/:id/basts` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |
| GET | `/projects/:id/basts/:handoverId` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| PUT | `/projects/:id/basts/:handoverId` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |
| POST | `/projects/:id/basts/:handoverId/cancel` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |
| GET | `/projects/:id/basts/draft` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |
| POST | `/projects/:id/cancel` | org member + permission | `project:close` | `owner`, `operations_manager`, `project_manager` |
| POST | `/projects/:id/close` | org member + permission | `project:close` | `owner`, `operations_manager`, `project_manager` |
| POST | `/projects/:id/costs` | org member + permission | `project:read_cost` `project:update` | `owner`, `project_manager` |
| POST | `/projects/:id/costs/:childId/void` | org member + permission | `project:read_cost` `project:update` | `owner`, `project_manager` |
| POST | `/projects/:id/evidence` | org member + permission | `task:update` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| DELETE | `/projects/:id/evidence/:childId` | org member + permission | `task:update` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| POST | `/projects/:id/tasks` | org member + permission | `task:create` | `owner`, `operations_manager`, `project_manager`, `hr` |
| DELETE | `/projects/:id/tasks/:childId` | org member + permission | `task:assign` | `owner`, `operations_manager`, `project_manager` |
| PUT | `/projects/:id/tasks/:childId` | org member + permission | `task:assign` | `owner`, `operations_manager`, `project_manager` |
| POST | `/projects/:id/tasks/:childId/status` | org member + permission | `task:update` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `hr` |
| POST | `/projects/api/v1/licenses/activate` | no guard macro | - | - |
| POST | `/projects/api/v1/licenses/deactivate` | no guard macro | - | - |
| POST | `/projects/api/v1/licenses/validate` | no guard macro | - | - |
| GET | `/projects/basts` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| GET | `/projects/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/projects/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/projects/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/projects/leads` | org member + permission | `lead:read` | `owner`, `sales` |
| POST | `/projects/leads` | org member + permission | `lead:create` | `owner`, `sales` |
| DELETE | `/projects/leads/:id` | org member + permission | `lead:archive` | `owner`, `sales` |
| GET | `/projects/leads/:id` | org member + permission | `lead:read` | `owner`, `sales` |
| PATCH | `/projects/leads/:id` | org member + permission | `lead:update` | `owner`, `sales` |
| POST | `/projects/leads/:id/activities` | org member + permission | `lead:update` | `owner`, `sales` |
| POST | `/projects/leads/:id/assign` | org member + permission | `lead:assign` | `owner`, `sales` |
| GET | `/projects/leads/:id/attachments/:attachmentId/url` | org member + permission | `lead:read` | `owner`, `sales` |
| POST | `/projects/leads/:id/convert` | org member + permission | `lead:update` `customer:create` | `owner`, `sales` |
| POST | `/projects/leads/:id/status` | org member + permission | `lead:update` | `owner`, `sales` |
| GET | `/projects/licenses` | org member + permission | `license:read` | `owner`, `sales`, `finance`, `customer_service` |
| POST | `/projects/licenses` | org member + permission | `license:create` | `owner`, `sales` |
| GET | `/projects/licenses/:id` | org member + permission | `license:read` | `owner`, `sales`, `finance`, `customer_service` |
| PUT | `/projects/licenses/:id` | org member + permission | `license:create` | `owner`, `sales` |
| POST | `/projects/licenses/:id/activate` | org member + permission | `license:activate` | `owner`, `sales` |
| POST | `/projects/licenses/:id/activations/:activationId/release` | org member + permission | `license:revoke` | `owner`, `sales` |
| POST | `/projects/licenses/:id/keys` | org member + permission | `license:create` | `owner`, `sales` |
| POST | `/projects/licenses/:id/keys/:keyId/revoke` | org member + permission | `license:revoke` | `owner`, `sales` |
| POST | `/projects/licenses/:id/reactivate` | org member + permission | `license:activate` | `owner`, `sales` |
| POST | `/projects/licenses/:id/renew` | org member + permission | `license:extend` | `owner`, `sales` |
| POST | `/projects/licenses/:id/suspend` | org member + permission | `license:activate` | `owner`, `sales` |
| POST | `/projects/licenses/:id/terminate` | org member + permission | `license:revoke` | `owner`, `sales` |
| GET | `/projects/licenses/applications` | org member + permission | `license:read` | `owner`, `sales`, `finance`, `customer_service` |
| POST | `/projects/licenses/applications` | org member + permission | `license:create` | `owner`, `sales` |
| PUT | `/projects/licenses/applications/:id` | org member + permission | `license:create` | `owner`, `sales` |
| GET | `/projects/licenses/applications/:id/api-keys` | org member + permission | `license:manage_api` | `owner`, `sales` |
| POST | `/projects/licenses/applications/:id/api-keys` | org member + permission | `license:manage_api` | `owner`, `sales` |
| POST | `/projects/licenses/applications/:id/api-keys/:apiKeyId/revoke` | org member + permission | `license:manage_api` | `owner`, `sales` |
| POST | `/projects/licenses/applications/:id/restore` | org member + permission | `license:create` | `owner`, `sales` |
| POST | `/projects/licenses/applications/:id/retire` | org member + permission | `license:create` | `owner`, `sales` |
| GET | `/projects/licenses/events` | org member + permission | `license:read` | `owner`, `sales`, `finance`, `customer_service` |
| GET | `/projects/licenses/summary` | org member + permission | `license:read` | `owner`, `sales`, `finance`, `customer_service` |
| GET | `/projects/me/projects` | no guard macro | - | - |
| GET | `/projects/me/projects/:id` | no guard macro | - | - |
| POST | `/projects/me/projects/:id/evidence` | no guard macro | - | - |
| DELETE | `/projects/me/projects/:id/evidence/:childId` | no guard macro | - | - |
| GET | `/projects/me/projects/:id/site-attendance` | no guard macro | - | - |
| POST | `/projects/me/projects/:id/tasks` | no guard macro | - | - |
| DELETE | `/projects/me/projects/:id/tasks/:childId` | no guard macro | - | - |
| PUT | `/projects/me/projects/:id/tasks/:childId` | no guard macro | - | - |
| POST | `/projects/me/projects/:id/tasks/:childId/status` | no guard macro | - | - |
| GET | `/projects/me/site-attendance` | no guard macro | - | - |
| POST | `/projects/me/site-attendance/:id/check-out` | no guard macro | - | - |
| POST | `/projects/me/site-attendance/check-in` | no guard macro | - | - |
| GET | `/projects/me/staff` | no guard macro | - | - |
| GET | `/projects/open-deals` | org member + permission | `project:create` | `owner`, `operations_manager`, `project_manager` |
| POST | `/projects/public/v1/contact` | public API key | - | - |
| POST | `/projects/public/v1/demo` | public API key | - | - |
| POST | `/projects/public/v1/rfq` | public API key | - | - |
| GET | `/projects/staff` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| GET | `/projects/stats` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| GET | `/warranties` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| GET | `/warranties/projects/:projectId` | org member + permission | `project:read` | `owner`, `operations_manager`, `project_manager`, `technician`, `freelancer`, `finance`, `customer_service` |
| PUT | `/warranties/projects/:projectId` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |
| GET | `/warranties/projects/:projectId/draft` | org member + permission | `project:update` | `owner`, `operations_manager`, `project_manager` |

### sale

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/sales/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/sales/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/sales/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/sales/delivery-notes` | org member | - | every organization member |
| POST | `/sales/delivery-notes` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| GET | `/sales/delivery-notes/:id` | org member | - | every organization member |
| POST | `/sales/delivery-notes/:id/cancel` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| POST | `/sales/delivery-notes/:id/deliver` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| POST | `/sales/delivery-notes/:id/ship` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| GET | `/sales/delivery-notes/deliverable-orders` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| GET | `/sales/delivery-notes/serials` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| GET | `/sales/delivery-notes/warehouses` | org member + permission | `stock:issue` | `owner`, `warehouse` |
| GET | `/sales/invoices` | org member + permission | `invoice:read` | `owner`, `finance` |
| POST | `/sales/invoices` | org member + permission | `invoice:create` | `owner`, `finance` |
| GET | `/sales/invoices/:id` | org member + permission | `invoice:read` | `owner`, `finance` |
| PATCH | `/sales/invoices/:id` | org member + permission | `invoice:update` | `owner`, `finance` |
| POST | `/sales/invoices/:id/cancel` | org member + permission | `invoice:update` | `owner`, `finance` |
| POST | `/sales/invoices/:id/issue` | org member + permission | `invoice:issue` | `owner`, `finance` |
| POST | `/sales/invoices/:id/receipts` | org member + permission | `receipt:create` | `owner`, `finance` |
| POST | `/sales/invoices/:id/void` | org member + permission | `invoice:void` | `owner`, `finance` |
| GET | `/sales/invoices/orders/:orderId/summary` | org member + permission | `invoice:read` | `owner`, `finance` |
| GET | `/sales/invoices/summary` | org member + permission | `invoice:read` | `owner`, `finance` |
| GET | `/sales/orders` | org member + permission | `sales_order:read` | `owner`, `sales`, `warehouse`, `finance` |
| POST | `/sales/orders` | org member + permission | `sales_order:create` | `owner`, `sales` |
| GET | `/sales/orders/:id` | org member + permission | `sales_order:read` | `owner`, `sales`, `warehouse`, `finance` |
| POST | `/sales/orders/:id/cancel` | org member + permission | `sales_order:cancel` | `owner`, `sales` |
| GET | `/sales/public/v1/render/quotations/:id` | no guard macro | - | - |
| GET | `/sales/quotations` | org member + permission | `quotation:read` | `owner`, `sales`, `finance` |
| POST | `/sales/quotations` | org member + permission | `quotation:create` | `owner`, `sales` |
| GET | `/sales/quotations/:id` | org member + permission | `quotation:read` | `owner`, `sales`, `finance` |
| PATCH | `/sales/quotations/:id` | org member + permission | `quotation:update` | `owner`, `sales` |
| POST | `/sales/quotations/:id/decision` | org member + permission | `quotation:approve` | `owner`, `sales` |
| POST | `/sales/quotations/:id/lost` | org member + permission | `quotation:update` | `owner`, `sales` |
| POST | `/sales/quotations/:id/revisions` | org member + permission | `quotation:update` | `owner`, `sales` |
| POST | `/sales/quotations/:id/send` | org member + permission | `quotation:send` | `owner`, `sales` |
| POST | `/sales/quotations/:id/submit` | org member + permission | `quotation:submit` | `owner`, `sales` |
| GET | `/sales/receipts` | org member + permission | `receipt:read` | `owner`, `finance` |
| POST | `/sales/receipts/:id/reverse` | org member + permission | `receipt:reverse` | `owner`, `finance` |
| GET | `/sales/returns` | org member + permission | `sales_return:read` | `owner`, `sales`, `warehouse`, `finance` |
| POST | `/sales/returns` | org member + permission | `sales_return:create` | `owner`, `sales` |
| GET | `/sales/returns/:id` | org member + permission | `sales_return:read` | `owner`, `sales`, `warehouse`, `finance` |
| PATCH | `/sales/returns/:id` | org member + permission | `sales_return:update` | `owner`, `sales` |
| POST | `/sales/returns/:id/cancel` | org member + permission | `sales_return:cancel` | `owner`, `sales` |
| POST | `/sales/returns/:id/decision` | org member + permission | `sales_return:approve` | `owner`, `sales` |
| POST | `/sales/returns/:id/receive` | org member + permission | `sales_return:receive` | `owner`, `warehouse` |
| POST | `/sales/returns/:id/submit` | org member + permission | `sales_return:submit` | `owner`, `sales` |
| GET | `/sales/returns/returnable-deliveries` | org member + permission | `sales_return:create` | `owner`, `sales` |

### supplier

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/suppliers/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/suppliers/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/suppliers/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/suppliers/companies` | org member + permission | `supplier:read` | `owner`, `purchasing`, `finance` |
| POST | `/suppliers/companies` | org member + permission | `supplier:create` | `owner`, `purchasing` |
| GET | `/suppliers/companies/:id` | org member + permission | `supplier:read` | `owner`, `purchasing`, `finance` |
| PATCH | `/suppliers/companies/:id` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| POST | `/suppliers/companies/:id/activate` | org member + permission | `supplier:archive` | `owner`, `purchasing` |
| POST | `/suppliers/companies/:id/addresses` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| DELETE | `/suppliers/companies/:id/addresses/:addressId` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| PATCH | `/suppliers/companies/:id/addresses/:addressId` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| POST | `/suppliers/companies/:id/deactivate` | org member + permission | `supplier:archive` | `owner`, `purchasing` |
| GET | `/suppliers/people` | org member + permission | `supplier:read` | `owner`, `purchasing`, `finance` |
| POST | `/suppliers/people` | org member + permission | `supplier:create` | `owner`, `purchasing` |
| DELETE | `/suppliers/people/:id` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| PATCH | `/suppliers/people/:id` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| POST | `/suppliers/people/:id/addresses` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| DELETE | `/suppliers/people/:id/addresses/:addressId` | org member + permission | `supplier:update` | `owner`, `purchasing` |
| PATCH | `/suppliers/people/:id/addresses/:addressId` | org member + permission | `supplier:update` | `owner`, `purchasing` |

### tax

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/taxes` | org member + permission | `tax:read` | `owner`, `finance` |
| POST | `/taxes` | org member + permission | `tax:update` | `owner`, `finance` |
| DELETE | `/taxes/:id` | org member + permission | `tax:update` | `owner`, `finance` |
| GET | `/taxes/:id` | org member + permission | `tax:read` | `owner`, `finance` |
| PATCH | `/taxes/:id` | org member + permission | `tax:update` | `owner`, `finance` |
| GET | `/taxes/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/taxes/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/taxes/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/taxes/coretax/bupot.xml` | org member + permission | `tax:export` | `owner`, `finance` |
| GET | `/taxes/coretax/faktur.xml` | org member + permission | `tax:export` | `owner`, `finance` |
| GET | `/taxes/export.csv` | org member + permission | `tax:export` | `owner`, `finance` |
| GET | `/taxes/export.xlsx` | org member + permission | `tax:export` | `owner`, `finance` |
| GET | `/taxes/pph21/tables` | org member + permission | `tax:read` | `owner`, `finance` |
| POST | `/taxes/pph21/ter-rates/import` | org member + permission | `tax:update` | `owner`, `finance` |
| GET | `/taxes/pph21/ter-rates/template.csv` | org member + permission | `tax:read` | `owner`, `finance` |
| GET | `/taxes/recap` | org member + permission | `tax:read` | `owner`, `finance` |
| GET | `/taxes/records` | org member + permission | `tax:read` | `owner`, `finance` |
| POST | `/taxes/records` | org member + permission | `tax:update` | `owner`, `finance` |
| GET | `/taxes/records/:id` | org member + permission | `tax:read` | `owner`, `finance` |
| PATCH | `/taxes/records/:id` | org member + permission | `tax:update` | `owner`, `finance` |
| GET | `/taxes/records/:id/corrections` | org member + permission | `tax:read` | `owner`, `finance` |
| POST | `/taxes/records/:id/corrections` | org member + permission | `tax:update` | `owner`, `finance` |
| POST | `/taxes/records/:id/transition` | org member + permission | `tax:verify` | `owner`, `finance` |
| POST | `/taxes/records/preview` | org member + permission | `tax:read` | `owner`, `finance` |
| GET | `/taxes/withholdings` | org member + permission | `tax:read` | `owner`, `finance` |
| POST | `/taxes/withholdings` | org member + permission | `tax:update` | `owner`, `finance` |
| GET | `/taxes/withholdings/:id` | org member + permission | `tax:read` | `owner`, `finance` |
| PATCH | `/taxes/withholdings/:id` | org member + permission | `tax:update` | `owner`, `finance` |
| PATCH | `/taxes/withholdings/:id/coretax` | org member + permission | `tax:update` | `owner`, `finance` |
| POST | `/taxes/withholdings/:id/transition` | org member + permission | `tax:verify` | `owner`, `finance` |

### ticket

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/tickets` | org member + permission | `service_ticket:read` | `owner`, `project_manager`, `technician`, `customer_service` |
| POST | `/tickets` | org member + permission | `service_ticket:create` | `owner`, `project_manager`, `customer_service` |
| GET | `/tickets/:id` | org member + permission | `service_ticket:read` | `owner`, `project_manager`, `technician`, `customer_service` |
| POST | `/tickets/:id/assign` | org member + permission | `service_ticket:assign` | `owner`, `project_manager`, `customer_service` |
| POST | `/tickets/:id/close` | org member + permission | `service_ticket:close` | `owner`, `project_manager`, `customer_service` |
| GET | `/tickets/:id/comments` | org member + permission | `service_ticket:read` | `owner`, `project_manager`, `technician`, `customer_service` |
| POST | `/tickets/:id/comments` | org member + permission | `service_ticket:update` | `owner`, `project_manager`, `technician`, `customer_service` |
| POST | `/tickets/:id/reopen` | org member + permission | `service_ticket:update` | `owner`, `project_manager`, `technician`, `customer_service` |
| POST | `/tickets/:id/resolve` | org member + permission | `service_ticket:resolve` | `owner`, `project_manager`, `technician`, `customer_service` |
| POST | `/tickets/:id/start` | org member + permission | `service_ticket:update` | `owner`, `project_manager`, `technician`, `customer_service` |
| GET | `/tickets/code-numberings` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| PUT | `/tickets/code-numberings/:codeType` | app admin, or org member + permission | `code_number:update` | app admin; `owner` |
| POST | `/tickets/code-numberings/:codeType/preview` | app admin, or org member + permission | `code_number:read` | app admin; `owner` |
| GET | `/tickets/technicians` | org member + permission | `service_ticket:assign` | `owner`, `project_manager`, `customer_service` |
| GET | `/tickets/warranty-check` | org member + permission | `service_ticket:create` | `owner`, `project_manager`, `customer_service` |

### user

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/admin/invitations/` | org member | - | every organization member |
| POST | `/admin/invitations/` | org member | - | every organization member |
| DELETE | `/admin/invitations/:invitationId` | org member | - | every organization member |
| POST | `/admin/invitations/:invitationId/cancel` | org member | - | every organization member |
| POST | `/admin/invitations/:invitationId/resend` | org member | - | every organization member |
| GET | `/admin/invitations/template` | org member | - | every organization member |
| GET | `/admin/users` | org member + permission | `member:read` | `owner`, `hr` |
| DELETE | `/admin/users/:userId` | org member + permission | `member:delete` | `owner` |
| POST | `/admin/users/:userId/deactivate` | org member + permission | `member:update` | `owner` |
| POST | `/admin/users/:userId/restore` | org member + permission | `member:update` | `owner` |
| PATCH | `/admin/users/:userId/roles` | org member + permission | `member:update` | `owner` |
| GET | `/invitations/claim/:token` | no guard macro | - | - |
| POST | `/invitations/claim/:token` | no guard macro | - | - |
| GET | `/username-availability/` | no guard macro | - | - |
| POST | `/users/` | org member | - | every organization member |
| DELETE | `/users/:userId` | org member | - | every organization member |
| GET | `/users/:userId` | org member | - | every organization member |
| PATCH | `/users/:userId` | org member | - | every organization member |
| POST | `/users/:userId/ban` | org member | - | every organization member |
| POST | `/users/:userId/restore` | org member | - | every organization member |
| PATCH | `/users/:userId/role` | org member | - | every organization member |
| POST | `/users/:userId/unban` | org member | - | every organization member |
| GET | `/users/me` | session | - | any signed-in user |
| PATCH | `/users/me` | session | - | any signed-in user |
| POST | `/users/me/avatar` | session | - | any signed-in user |

### warehouse

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| GET | `/warehouses` | session + app admin | - | app admin |
| POST | `/warehouses` | session + app admin | - | app admin |
| DELETE | `/warehouses/:id` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| GET | `/warehouses/:id` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| PATCH | `/warehouses/:id` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| DELETE | `/warehouses/:id/address` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| GET | `/warehouses/:id/address` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| PUT | `/warehouses/:id/address` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| DELETE | `/warehouses/:id/image` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| PUT | `/warehouses/:id/image` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| GET | `/warehouses/:id/images` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| POST | `/warehouses/:id/images` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| DELETE | `/warehouses/:id/images/:imageId` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| PATCH | `/warehouses/:id/images/:imageId` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| PUT | `/warehouses/:id/images/order` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| GET | `/warehouses/:id/managers` | session + app admin | - | app admin |
| POST | `/warehouses/:id/managers` | session + app admin | - | app admin |
| DELETE | `/warehouses/:id/managers/:userId` | session + app admin | - | app admin |
| GET | `/warehouses/:id/organizations` | session + app admin | - | app admin |
| POST | `/warehouses/:id/organizations` | session + app admin | - | app admin |
| DELETE | `/warehouses/:id/organizations/:organizationId` | session + app admin | - | app admin |
| GET | `/warehouses/:id/storages` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| POST | `/warehouses/:id/storages` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| DELETE | `/warehouses/:id/storages/:storageId` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| PATCH | `/warehouses/:id/storages/:storageId` | warehouse PIC (action) or app admin route | - | PIC of the warehouse |
| GET | `/warehouses/code-numberings` | app admin | `code_number:read` | app admin |
| PUT | `/warehouses/code-numberings/:codeType` | app admin | `code_number:update` | app admin |
| POST | `/warehouses/code-numberings/:codeType/preview` | app admin | `code_number:read` | app admin |
| GET | `/warehouses/linked` | org member | - | every organization member |
| GET | `/warehouses/manager-candidates` | session + app admin | - | app admin |
| GET | `/warehouses/mine` | session | - | any signed-in user |

### webhook

| Method | Path | Guard | Requirement | Who |
| --- | --- | --- | --- | --- |
| POST | `/webhooks/:provider` | no guard macro | - | - |

<!-- END GENERATED -->
