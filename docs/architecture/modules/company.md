# Company Module

> Created 2026-11-13 (ERP-0042, ADR-0015). Reflects `apps/backend/src/app/company`
> and the `/settings/company` + `/settings/documents` pages of web-admin.

## Purpose and boundary

The one legal company behind every organization: its letterhead profile, head
office address, contact channels, the bank accounts printed on invoices, and
the company-wide key/value settings store. One company per application
(ADR-0011); multiple *organizations* sit under it, and a later multi-company
model (`company_id` on `organization.*`) is deliberately unbuilt (ADR-0007).

Before ERP-0042 all of this lived inside the Organization module, alongside the
numbering series and the document registry. It was split out because the three
had nothing in common beyond sharing a caller: the company profile is data
printed once and never enumerated, the numbering series is a contended
allocator, the registry is an append-only log of issued documents.

**Does not own**: operational cash/bank balances (Finance owns
`finance.cash_bank_accounts`), organization structure and membership
(Organization), number allocation (Code Number), issued documents (Document).

## Data ownership

Five tables, all company-wide - there is no `organization_id` column anywhere in
the schema, so no query in this module can be scoped to an organization and none
needs to be.

| Table | Contents |
|---|---|
| `company.profiles` | legal name, trading name, `document_code`, tagline, tax id (`NPWP`), logo + signature object keys, and the values printed on documents: signatory name/title, default quotation/invoice terms, warranty coverage/exclusions/service terms. Exactly one row. |
| `company.head_office_addresses` | the printed office address. `village_id` is a logical reference to `location.villages.id` (ADR-0003, ADR-0014) validated through the Location contract; the rest is free text. |
| `company.contacts` | email / phone / website channels, split out of `profiles` so a channel can be added without touching the letterhead row. |
| `company.bank_accounts` | the company's own accounts printed on invoices, with a `kind` discriminator for the VAT / non-VAT pair. Not balances: no amount column exists. |
| `company.settings` | the company-wide key/value store (ERP-0045): `setting_group`, `setting_key`, `value` (text), `value_type` (`string|number|boolean|json|date`), `updated_by`, `is_secret` (reserved `false`). |

`company.profiles.document_code` is `{COMPANY}` in every numbering pattern, so
Code Number reads the profile before it renders a number - a missing profile is
a hard error there, not a blank token.

The API keeps the flat profile shape (`legalName`, `addressLine`, `phone`,
`signatureUrl`, `bankAccounts.vat`, ...) while storage is split across three
tables. The repository owns the mapping, so no other module and no client sees
the split.

## Exported contract

```ts
interface ICompanyService {
  getProfile(tx?: TTx): Promise<TCompanyProfileSnapshot | null>;
}
```

`getProfile` returns the letterhead snapshot or `null` before the profile was
first saved. The optional `tx` is the important part: Code Number and Document
call it **inside their own transaction**, so a number and the registry row that
uses it read the same letterhead even if someone edits the profile at the same
moment.

There is no `assert...` method. The company profile is not referenced by id
from any other table - `document.*` and the numbering series point at the
company implicitly, because there is only one.

## API

Routes live under `/company` (prefix `/company`, guard `erp`):

| Route | Permission | Notes |
|---|---|---|
| `GET /company/profile` | none (any member) | every printed document needs the letterhead. The invoice bank accounts are only included for holders of `company:read` or `invoice:read` |
| `PUT /company/profile` | `company:update` | **patch**, not replace: `companyProfilePatchSchema` accepts any subset and merges over `toFlat()` of the stored profile |
| `PUT /company/profile/:kind` | `company:update` | multipart image upload, `kind` is `logo` or `signature` |
| `DELETE /company/profile/:kind` | `company:update` | clears the object key |
| `GET /company/settings` | `company:read` | every setting (group, key, type, value) |
| `PUT /company/settings/:group/:key` | `company:update` | upsert; single statement on the `(setting_group, setting_key)` partial unique index |

`PUT /company/profile` being a patch matters: ERP-0045c removed the signatory,
bank accounts, default terms and warranty fields from the UI. With a replace
semantics those fields would be silently nulled on the next save from the
trimmed form. With the patch they keep their stored value, and they keep
printing on documents.

No delete route for settings: a setting is cleared by writing an empty value,
which the service deletes or empties per `value_type`.

## Settings and secrets

`company.settings` is a generic store, not a typed config table. The service
validates the value against `value_type` on write (`abc` into a `number` row is
a 422) and the DB has a CHECK on the pair as a second line of defence.
`is_secret` exists in the schema but is **reserved `false`**: the API neither
accepts nor returns it. When a genuinely secret setting arrives it gets its own
decision, not a quiet `true` in this table.

Organization-scoped settings are a different table (`organization.settings`,
ERP-0045b, not built). Two tables named `settings` is why `validate-dbml.ts`
whitelists `settings` in `DUP_ALLOWED` - they are different entities and every
reference is schema-qualified.

## UI

- `/settings/company` (`routes/_authed/settings/company/index.tsx`) - the
  trimmed form: identity (legal name, trading name, company code, tagline, tax
  id) and contact (address, postal code, phone, email, website), plus the
  `company` settings card with the `document` group excluded.
- `/settings/documents` - the letterhead logo and the `document` settings
  group. The company signature image is **not** here: signatures get their own
  module (ERP-0048/ERP-0049).
- `/admin/company` and `/admin/code-numbers` redirect to `/settings/*`
  (ERP-0045c). `documentCode` is labelled "Company code" with the hint "Used by
  document numbers ({COMPANY})".

`PUT`/`DELETE /company/profile/signature` still exist even though no UI calls
them. Removing them would stop an already-stored signature from printing:
`quotation-document.tsx`, `purchase-order-document.tsx` and
`warranty-document.tsx` still render `profile.signatureUrl`. A fresh install
prints documents without a signature until the signature module fills it.

## Tests

`test/unit/company.service.test.ts` - 19 tests across five suites: the base
service, "without bank accounts in the input", partial update (the ERP-0045c
patch behaviour), images, and the ERP-0045 settings store. The settings suite
covers the per-type value check, the empty-value clear, and the secret field
being neither accepted nor returned.
