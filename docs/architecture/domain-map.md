# Domain Map

Business capability ownership across the ERP. Engineering groupings — not a
claim to reproduce the original "12 business module groups, 13 SOPs, 32
commercial tasks" verbatim. **That original list is not available in the
repository; if it surfaces, it takes precedence and `backlog.md` IDs get
re-mapped. Mark verbatim-mapping as pending.**

## Quick note on what is real

> Updated 2026-11-20 for ADR-0024: the ERP is **18 Postgres schemas / 188
> tables** plus the schema-less `webhook` module. The map below is business
> ownership; per-module tables, contracts and boundaries live in
> `docs/database/module-ownership.md` and `docs/database/docs.dbml`. A module
> being listed here is not a claim that every capability is built: see
> `docs/plan/progress.md` and `docs/plan/backlog.md` for status (all of
> ERP-0070..0089 were still `in-progress`, none `accepted`, on 2026-11-20).

## Capability → owner map

| Capability group | Owner module(s) | Coverage |
|---|---|---|
| Company, users, roles, permissions, audit | `company`, `auth` (Identity; `user` and `organization` modules sit over it), `document`, `notification`, `audit` | Company profile and settings = `company.*`; issued document registry = `document.*`; audit trail = `audit.audit_logs`; users, organizations, members = Better Auth; roles are a code-defined enum (no role table). Numbering is per module (`code_numberings` in each schema) |
| Customers & leads | `customer`, `project` (leads), `automation` | B2B companies and people (incl. portal login) in `customer`; leads and follow-up in `project`; approved FAQ knowledge and WhatsApp in `automation` |
| Suppliers & procurement | `supplier`, `procurement`, `finance` | Supplier companies/PICs (bank details restricted); purchase requests/orders/receipts/returns; supplier bills and payables in `finance` |
| Products, stock & warehouse | `inventory` | Products and categories, physical items/assets, stock ledger and balances, adjustments, borrowing, maintenance, disposals; the warehouse tables live in `inventory` (one schema, ADR-0008/ADR-0024) |
| Sales & payments | `sale`, `payment` | Quotation, order, delivery note, return, invoice, receipt; one payment ledger (channel manual or gateway) with allocations |
| Accounting & expenses | `finance` | COA, periods, journals, opening balances, cash/bank, reconciliation, supplier bills, AR/AP, expense claims, advances, depreciation, period close |
| Tax | `tax` | Taxes, period records, corrections, withholding records (configurable recap; filing stays with finance) |
| Financial reporting | `finance` (reports) | P&L, balance sheet, cash flow, aging; depth of each report is per `progress.md`, not claimed here |
| Assets & projects | `inventory` (assets/tools, depreciation basis), `project` | Projects, tasks, handover/BAST, costs, warranties; asset depreciation is posted by `finance` |
| After-sales tickets | `ticket` | Tickets and messages; warranty is checked through `project` |
| People & payroll | `human_resource` | Employees, attendance, leave, overtime, tasks, salaries and salary records. Payroll run/approval/posting depth: see `progress.md` |
| Subscription & licensing | `project` | License applications, contracts, keys, activations, events; machine API at `/projects/api/v1/licenses` |
| Investors & profit sharing | not assigned | The former `investor` module was removed by ADR-0024; business scope still to be decided |
| Digital integrations & portals | `webhook` (inbound edge), `payment` (gateway), `automation` (n8n outbox, WhatsApp), `customer` (portal login) | Checkout, one gateway, WhatsApp, n8n; customer portal at `/customers/portal/v1`; no investor portal today |

## Master data catalog (target model)

1. **Company** — legal/display name, addresses, contacts, tax identity, logo,
   bank references.
2. **Customers** — code, individual/company name, address (structured Indonesian
   refs: ADR-0003), contact person, WhatsApp, email, optional tax identity.
3. **Suppliers** — code, name, address, contact person, payment terms, bank
   details (restricted access).
4. **Products / services** — SKU, name, category, unit, selling price (integer
   IDR minor units, ADR-0002), stock flag, optional serial tracking; one catalog
   entity with type discriminator (decide in Phase 3; do not duplicate tables
   without need).
5. **Categories & units** — consistent definitions (units, sets, pieces,
   packages, months, years).
6. **Warehouse** — one operational warehouse (code, name, address, responsible
   employee); stored in `inventory.warehouses` and related tables.
7. **Assets/tools** — code, category, serial, acquisition value/date, location,
   responsible person, condition.
8. **Employees** — code, name, position, contact, joining date, status, salary
   bank details (restricted access).
9. **Chart of accounts** — code, name, classification, normal balance, report
   mapping, posting restrictions.
10. **Cash/bank accounts** — code, bank, account number, holder, linked ledger
    account.
11. **Subscription packages** — software/product, duration, price, renewal
    policy.
12. **Licensed applications** — application identity + package references; one
    integrated pilot client.
13. **Investors** — code, name, contacts, bank, portal identity linkage.
14. **System users** — auth identity, active state, optional
    employee/customer/investor association.

Supporting configuration: permissions, payroll components/rules, effective-dated
tax parameters, one agreed profit-sharing scheme, licensing rules, document
templates/numbering, workflow statuses, approved FAQ knowledge, external
provider configuration. Secrets only in server-side config; never in shared
contracts or public API responses.

## Isolation and tenancy

**One company, multiple internal organizations** (ADR-0001, extended by
ADR-0007). Better Auth `organization` plugin + `auth.members` provide internal
role/membership structure inside the one company (the former `organization`
schema with branches, departments and positions was removed by ADR-0024;
`auth.organizations` and `auth.organization_settings` remain). Several
organizations may coexist — each with its own membership, with roles from the
closed code-defined enum — but they are **not** a tenant dimension: there
is no cross-company tenant column in ERP master data, and master data is shared
company-wide. A later migration path exists if true multi-tenancy is ever
needed. Portal users get row-scoped ownership checks (customer sees own
invoices; investor sees own capital), not tenant scoping.

## Opening data vs transactions

- **Opening imports** (separate from reusable master data): opening ledger
  balances, opening stock, outstanding receivables/payables, investor capital,
  active subscriptions, ongoing projects.
- **Transactions:** invoices, payments, attendance, payroll runs, stock
  movements, distributions.
- **Derived outputs:** financial reports, tax recaps, payslips.

## Scope boundaries (do not silently expand)

- One warehouse; one payment provider; one WhatsApp number/provider; one
  licensing pilot application; one agreed profit-sharing scheme.
- Payroll: approved salary/allowance/deduction/overtime rules, approval,
  payslips, journals — not every statutory variation.
- Customer portal: only the customer's own records (orders, invoices,
  payments, projects/licenses, tickets).
- Investor portal: read-only, own capital/distributions/payment history.
- Tax: configurable recap/workpapers only; filing stays with finance.
- Hosting, domains, AI/WhatsApp usage costs, gateway fees, complex approvals,
  all-device integrations are not implicitly included.
