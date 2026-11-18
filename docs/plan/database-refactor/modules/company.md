# company - ERP-0073

Schema `company` · folder `src/app/company` · URL `/companies` (was `/company`) · phase P1

## Current

Tables profiles, head_office_addresses, contacts, bank_accounts, settings.
One repository (`company.repository.ts`) serves all five tables. Consumer:
`web-admin/src/lib/company-api.ts` (+ branding, ERP-0064).

## Target tables

| Table | From | Change |
|---|---|---|
| profiles | profiles | unchanged (`updated_by` is the auth.users link) |
| addresses | head_office_addresses | rename; Q10 shape |
| contacts | contacts | unchanged |
| settings | settings | unchanged |

`bank_accounts` moves to `finance.cash_bank_accounts` (ERP-0079).

## Steps

1. **dbml** - rename table, drop `bank_accounts`, update notes.
2. **Drizzle** - `company.schema.ts` accordingly.
3. **Repositories** - split into `profile`, `address`, `contact`, `setting`
   repositories (one per table).
4. **Services** - `ExportedCompanyService`: `getDocumentCode()`,
   `getLetterhead()` (profile + primary address + primary contacts) - used by
   every module that prints or numbers documents. Invoice bank accounts are
   read from `ExportedCashBankAccountService` (finance) by the print services,
   not by company.
5. **Controllers** - prefix `/companies`; bank-account endpoints removed
   (served by `/finance/cash-bank-accounts`).
6. **Consumers** - web-admin `company-api.ts` paths; company settings page
   bank-account tab calls finance; web-landing/web-customer-portal branding
   calls (if any) to `/companies/public/v1/branding`.

## Exit

Letterhead/branding unchanged on screen; company tests green.
