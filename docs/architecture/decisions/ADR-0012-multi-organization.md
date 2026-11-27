# ADR-0012 — Multiple Organizations, Company-Wide Master Data

- **Status:** accepted (2026-11-08). Applies ADR-0007 to transaction documents
  that record the organization which issued them. Does not supersede ADR-0007
  or ADR-0008. Amended 2026-11-08 by ADR-0014: the `organization_id`
  reference is nullable (was `NOT NULL`).
- **Status update 2026-11-28 (T-6, recorded by programmer B, reviewed by Oki):** to be **superseded** by the K12 ADR. **Duplicate number:** two files carry ADR-0012; this one is in force, `ADR-0012-single-organization.md` is superseded.
- **Context:** ADR-0007 allows several internal organizations inside one
  company (for example a Jakarta HQ and a Bali branch) and keeps master data
  company-wide. It does not say which transaction documents carry the
  organization that issued them. A sales invoice is issued by a specific
  organization, so its ownership must be attributable to that organization.
  The single-organization reading (one organization per
  company) is not valid: ADR-0007 §1 removed that invariant.

- **Decision:**
  1. **Multiple internal organizations are allowed inside one company**
     (ADR-0007 §1). There is no single-organization invariant.
  2. **Master data stays company-wide** with no `organization_id` column
     (ADR-0007 §2). The inventory exception stays in ADR-0008.
  3. **A transaction document records its issuing organization** in an
     `organization_id` logical reference. `sales.invoices` is the first table
     under this rule. Other transaction documents follow it only when their
     module's plan says so.
  4. **`organization_id` on an invoice is the issuing organization.** It is a
     nullable logical reference to `auth.organizations.id` (ADR-0014),
     validated through the Identity module contract, with no cross-schema
     foreign key.
  5. **Document codes are unique per issuing organization** using the
     ADR-0008 partial-unique pair: `UNIQUE (organization_id, code) WHERE
     organization_id IS NOT NULL` and `UNIQUE (code) WHERE organization_id
     IS NULL`.

- **Consequences:**
  - `sales.invoices` keeps `organization_id` as a nullable logical reference.
    Presence is enforced at the service layer, not by the database.
  - A rule that removes `organization_id` from `sales.invoices` is not valid
    under this ADR, even though it would follow from a single-organization
    reading.
  - ADR-0013's company-wide code reading does not apply: sequence counters
    are per organization.

- **Alternatives considered:**
  - **Single organization per company** - rejected: ADR-0007 §1 removed it.
  - **Drop `organization_id` from `sales.invoices` and keep invoices
    company-wide** - rejected: invoices are issued by an organization, and
    without the column the issuer is lost once several organizations exist.
  - **`organization_id NOT NULL` on transaction documents** - rejected by
    ADR-0014: cross-module references are nullable; presence is a service-
    layer fact.
  - **Company-wide document code sequence** - rejected: codes are issued per
    organization, so a company-wide unique would leak one organization's
    counter into another's numbering.
