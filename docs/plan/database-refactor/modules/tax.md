# tax - ERP-0080

Schema `tax` (new) · folder `src/app/tax` (split from `accounting`) · URL `/taxes` (was `/tax`) · phase P5

## Current

`accounting.tax_types`, `tax_records`, `tax_corrections`,
`withholding_tax_records`; `accounting/repositories/tax.repository.ts` (serves
several tables); `tax.controller` at `/tax`. Consumer: web-admin `tax-api.ts`
(`/finance/tax/*` routes).

## Target tables (Q19)

| Table | From |
|---|---|
| taxes | tax_types (effective-dated rates, non-overlap rule in service) |
| records | tax_records (recap per tax per period) |
| corrections | tax_corrections (signed, evidence -> document.documents) |
| withholding_tax_records | accounting.withholding_tax_records (`counterparty_type/id` polymorph kept) |
| code_numberings | tax record / withholding codes |

## Steps

1. **dbml** - new module section.
2. **Drizzle** - `tax.schema.ts`.
3. **Repositories** - tax, record, correction, withholding-tax-record,
   code-numbering.
4. **Services** - `TaxService` (rates for sale/procurement/finance, recap,
   corrections). Recap reads posted journals via `ExportedJournalService`
   (finance). Publish `ExportedTaxService` (repository-only rate lookup) so
   finance can call tax without a cycle.
5. **Controllers** - `/taxes`, `/taxes/records`, `/taxes/corrections`,
   `/taxes/withholdings`.
6. **Consumers** - `tax-api.ts` paths; routes keep their place in the finance
   menu.

## Exit

VAT rate lookups from sale/procurement and the recap tests green.
