# customer - ERP-0074

Schema `customer` (was `crm`) · folder `src/app/customer` (was `crm`; absorbs
`portal`) · URL `/customers` · phase P2

## Current

- `crm` tables: customers, customer_contacts, leads, lead_activities,
  lead_attachments. Repositories: customer, customer-contact, lead,
  lead-activity. Controllers: customer (`/customers`), lead (`/leads`),
  public-website (`/public/v1` inquiries).
- `auth.portal_identities` (Drizzle `portal.schema.ts`), read by `user`.
- Consumers: web-admin `customer-api.ts`, `lead-api.ts`,
  `portal-account-api.ts`; web-customer-portal `src/api/portal.ts`.

## Target tables (Q5, Q16)

| Table | Columns of note |
|---|---|
| companies | code, name, legal_name, company_type (company/government/partner), tax_id, email, phone, status, owner_user_id, notes |
| customers | code, company_id (nullable, intra-schema FK), name, position, email, phone, whatsapp, is_primary (per company), customer_type (individual/contact), status, **user_id** (nullable, logical -> auth.users, partial unique on live rows), **portal_role** (owner/approver/finance/viewer), **portal_status** (active/suspended/revoked), portal_invited_by, portal_last_login_at |
| addresses | customer_id FK, Q10 address columns |
| company_addresses | company_id FK, kind (billing/shipping/site/other), Q10 columns |
| settings | key-value |
| code_numberings | customer / company codes |

Data move (seed concern under Q2): `crm.customers` of type company/government/
partner -> `companies` (+ primary address -> `company_addresses`); their
`customer_contacts` -> `customers` with `company_id`; individual
`crm.customers` -> `customers` (+ address -> `addresses`);
`portal_identities` -> `customers.user_id` + portal columns of the matching
contact.

Leads leave this module (-> `project`, Q12).

## Steps

1. **dbml** - new module section; remove `crm`; update every logical
   reference listed in `01-target-schema.md` (quotations, orders, invoices,
   receipts, projects, tickets, borrowings, item_serials, AR open items,
   payments counterparty).
2. **Drizzle** - `customer.schema.ts` (`pgSchema('customer')`); delete
   `crm.schema.ts`.
3. **Repositories** - company, customer, address, company-address, setting,
   code-numbering.
4. **Services**
   - `CustomerService`, `CompanyService`, `PortalAccountService` (staff invites,
     owner invites colleagues, revoke), `PortalAuthService` (sign-up by email
     code; calls `ExportedUserService.createPortalLogin`).
   - `ExportedCustomerService` (repository-only): `assertActiveCustomer`,
     `assertActiveCompany`, `getSnapshot(customerId?, companyId?)` (document
     snapshot), `resolvePortalIdentity(userId)`, `createFromLead(lead)` (used
     by project, Q23).
   - Portal read endpoints call `ExportedInvoiceService` (sale),
     `ExportedTicketService` (ticket), `ExportedProjectService` (project) -
     customer never calls their full services, so no cycle.
5. **Controllers** - `/customers`, `/customers/companies`,
   `/admin/customers/portal-accounts`, `/customers/portal/v1/*` (was
   `/portal/v1`, `/portal/v1/auth`). No alias: web-customer-portal is in this
   repository and is updated in the same phase.
6. **Consumers**
   - web-admin: `customer-api.ts` split into customers + companies; customer
     pages get a Company tab and a People tab; `portal-account-api.ts` paths.
   - web-customer-portal: `src/api/client.ts` base path, `portal.ts`,
     `portal-schemas.ts` (customer + company shape), `src/actions/index.ts`.
   - locales en/id: new keys for company/person labels; dead keys removed.

## Exit

Portal login, invite, revoke and portal reads work against the new tables in
unit tests; locale parity green.
