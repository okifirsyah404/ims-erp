# ADR-0012 - Multiple Organizations, Company-Wide Master Data

- **Status:** accepted (2026-11-08). Applies ADR-0007 to transaction documents
  that record the organization which issued them. Does not supersede ADR-0007
  or ADR-0008.
- **Context:** ADR-0007 allows several internal organizations inside one
  company (for example a Jakarta HQ and a Bali branch) and keeps master data
  company-wide. It does not say which transaction documents carry the
  organization that issued them. A sales invoice is issued by a specific
  organization, so its code sequence and its ownership must be attributable to
  that organization. The single-organization reading (one organization per
  company) is not valid: ADR-0007 §1 removed that invariant.

- **Decision:**
  1. **Multiple internal organizations are allowed inside one company**
     (ADR-0007 §1). There is no single-organization invariant.
  2. **Master data stays company-wide** with no `organization_id` column
     (ADR-0007 §2). The inventory exception stays in ADR-0008.
  3. **A transaction document records its issuing organization** in a
     `NOT NULL organization_id`. `sales.invoices` is the first table under this
     rule. Other transaction documents follow it only when their module's plan
     says so.
  4. **`organization_id` on an invoice is the issuing organization.** It is a
     logical reference to `auth.organizations.id`, validated through the
     Identity module contract, with no cross-schema foreign key.

- **Consequences:**
  - `sales.invoices` keeps `organization_id NOT NULL`, and its code is unique
    per issuing organization (`invoices_org_code_uq`).
  - A rule that removes `organization_id` from `sales.invoices` is not valid
    under this ADR, even though it would follow from a single-organization
    reading.

- **Alternatives considered:**
  - **Single organization per company** - rejected: ADR-0007 §1 removed it.
  - **Drop `organization_id` from `sales.invoices` and keep invoices
    company-wide** - rejected: invoices are issued by an organization, and
    without the column the issuer and its code sequence are lost once several
    organizations exist.
