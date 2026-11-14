# ADR-0015 - Company / Document / Code Number Schema Split

- **Status:** accepted (2026-11-13), implemented as ERP-0042.
- **Supersedes:** the parts of ADR-0001 and ADR-0013 that place the company
  profile, the invoice bank accounts and the numbering series inside the
  Organization module. The decisions themselves (one company, one numbering
  authority) are unchanged; only the owning module and the schema names moved.

## Context

The Organization module carried three responsibilities that share nothing but a
caller:

1. **The company profile** - one row of letterhead data, printed on every
   document, edited once during setup and then almost never. Read on every
   document render, written by one page.
2. **The numbering series** - a contended allocator. Every document creation
   writes it inside its own transaction, and a duplicate number is a business
   error. Correctness depends on one statement, not on a rich aggregate.
3. **The document registry** - an append-only log of issued documents, with
   files, signatures, an access trail and public share tokens. It grows forever
   and is never joined to the organization's own columns.

Keeping them together produced concrete problems:

- The Organization module's Drizzle schema file mixed Better Auth's organization
  tables with the company profile and the sequences, so a change to one forced a
  review of all three.
- `organization.company_profiles.organization_id` made the profile look
  per-organization. It never was: ADR-0001/ADR-0007 establish one company and
  no tenant dimension, so the column carried exactly one value and every
  "scope" query was dead code. It was a 1:1 table whose parent column was a
  fiction.
- `organization.document_sequences` competed with `documents.*` for the word
  "document" in the schema name while meaning something else (a number series).
- Permissions were lumped into one `company_setting` resource, so reading the
  letterhead and rewriting an invoice number needed the same grant.

## Decision

Split Organization into three sibling modules, each with its own Postgres
schema, its own Drizzle schema file, its own contract, and its own permission
resource.

| Module | Code path | Schema | Tables |
|---|---|---|---|
| Company | `src/app/company` | `company` | `profiles`, `head_office_addresses`, `contacts`, `bank_accounts`, `settings` |
| Code Number | `src/app/code-number` | `code_number` | `series` |
| Document | `src/app/document` | `document` | `templates`, `documents`, `files`, `signatures`, `access_logs`, `shares`, `tags`, `tag_links` |

Complementary rules:

1. **One module owns exactly one Postgres schema.** There is no two-schema
   module left; the retired `warehouse` schema (ADR-0008) is history. A schema
   boundary is therefore always a module boundary, so a cross-module link is
   always cross-schema and is always logical (ADR-0014).
2. **Organization keeps its own scope**: the organization row, membership, the
   per-organization role catalog and `organization.settings`. It no longer
   owns a company profile, bank accounts or a numbering series.
3. **The three new schemas are company-wide.** No table in `company.*` or
   `code_number.*` has an `organization_id`; `document.*` keeps a **nullable**
   one because an issued document records the issuing department (ADR-0011
   pattern, ADR-0014).
4. **Rename, do not reinvent.** `organization.document_sequences` became
   `code_number.series` verbatim, with `document_type` → `code_type` and the
   service renamed `NumberingService` → `CodeNumberService`. The allocation
   statement, the patterns and the tokens are unchanged, so already-issued
   numbers stay valid.
5. **`company.profiles.document_code` stays the `{COMPANY}` source.** Code
   Number reads it through `ICompanyService.getProfile(tx)` inside the caller's
   transaction, so a number and the letterhead it embeds cannot disagree.
6. **Permissions follow the split.** `company_setting:*` is retired in favour of
   `company:*` (read/update), `code_number:*` (read/update) and
   `document:*` (read/create/update/submit/approve/issue/void/download).

## Consequences

- **Three append-only migrations, one per schema**, plus the rename of the
  sequence table. The old tables are dropped only after the new ones are
  populated, in the same migration set, with the profile row copied across.
- **`organization.company_profiles`, `organization.company_bank_accounts` and
  `organization.document_sequences` disappear from the contract.** Historical
  references to them in the docs are marked historical, not silently rewritten.
- **New modules mean new docs**: `architecture/modules/company.md`,
  `code-number.md` and `document.md`, and three new rows in
  `database/module-ownership.md`. The module count moves 24 → 26 and the docs
  header in `docs.dbml` follows.
- **No multi-company.** The split makes a later `company_id` column possible on
  `company.*` and `organization.*`, but it is not built: `company.profiles`
  holds exactly one row and there is no subsidiary concept. That stays out of
  scope until requested.
- **A removed UI field is not a removed column.** ERP-0045c took the signatory,
  bank accounts, default terms and warranty texts off `/settings/company`, and
  the company signature image off `/settings/documents`. The columns and the
  `PUT`/`DELETE /company/profile/:kind` routes stay, because stored values still
  print on documents; `PUT /company/profile` became a patch so a save from the
  trimmed form cannot null them.
- **Cost of being wrong.** If the company profile ever does become
  per-organization, the profile table needs a scope column back and this ADR is
  reversed - which is cheaper now than when the profile, the numbers and the
  registry all move together.
