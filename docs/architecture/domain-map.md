# Domain Map

Business capability ownership across the ERP. Engineering groupings — not a
claim to reproduce the original "12 business module groups, 13 SOPs, 32
commercial tasks" verbatim. **That original list is not available in the
repository; if it surfaces, it takes precedence and `backlog.md` IDs get
re-mapped. Mark verbatim-mapping as pending.**

## Quick note on what is real

Modules marked scaffold-only exist as empty `*.module.ts` + empty
controller/service (see `project-audit.md`). Ownership below is the target map,
not an implementation claim.

## Capability → owner map

| Capability group | Owner module(s) | Coverage |
|---|---|---|
| Company, users, roles, permissions, audit | `user`, `notification`, `auth` (to be created), Better Auth plugins; `audit_logs` table | Company profile/bank refs/audit trail = `erp` schema; users/roles = Better Auth |
| Customers & CRM | `customer` (company-wide CRM data), `notification` | Customers + contacts + lead/follow-up planning; approved FAQ knowledge (catalog knowledge) |
| Suppliers & procurement | `supplier`, `purchasing` | Supplier master, purchase bills, payables, supplier payments |
| Catalog & stock | `product`, `inventory`, `warehouse` | Products/services + categories/units; stock movements + valuation boundaries; single operational warehouse |
| Sales & payments | `sales`, `payment` | Quotation (SPH), invoice, DP, partial payments, settlements, receipts, receivables |
| Expenses & accounting | `expense` (operational costs), accounting to be located | COA, opening balances, journals, ledger, trial balance, reconciliation, period closing |
| Financial reporting & tax | `reporting`; tax to be located | P&L, balance sheet, cash flow, drill-down, configurable tax recap |
| Assets & projects | not yet assigned (assess: extend `inventory` or a new `asset/project` domain) | Assets/tools incl. depreciation, project progress, handover/BAST |
| People & payroll | `employee` | Employee master, approved inputs, salary components, payroll run, approval, payslip, posting |
| Subscription & licensing | `product` + `payment` (assess for a licensing owner) | Packages, contracts, renewal, activation, validation, expiry/suspend |
| Investors & profit sharing | `investors` table exists; module to be created | Investor master, capital records, approved distributions, payment history |
| Digital integrations & portals | `payment` (gateway), `notification` (WhatsApp), `user`/`auth` (portal identity) | Checkout, one gateway, WhatsApp AI, optional n8n, customer + investor portals |

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
   employee).
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
role/membership structure (departments, teams, portal groups inside the one
company). Several organizations may coexist — each with its own membership and
per-organization role catalog — but they are **not** a tenant dimension: there
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
