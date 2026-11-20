# supplier - ERP-0075

Schema `supplier` (new) · folder `src/app/supplier` (split from `procurement`) ·
URL `/suppliers` · phase P2

## Current

`procurement.suppliers` (company-wide, PIC and bank columns inline).
Repository `supplier.repository.ts` and controller `/suppliers` live in
`procurement`. Consumer: web-admin `procurement-api.ts` supplier calls.

## Target tables (Q17)

| Table | Columns of note |
|---|---|
| companies | code (`{SUPPLIER}` token of PO numbers), name, legal_name, supplier_type, tax_id, email, phone, website, payment_terms_days, payment_term_note, bank_name, bank_account_number, bank_account_holder (restricted: `supplier:read_bank`), status |
| suppliers | company_id (nullable FK), name, title, phone, email, whatsapp, is_primary, status (individual supplier = no company) |
| addresses | supplier_id FK, Q10 columns |
| company_addresses | company_id FK, kind (office/factory/warehouse/billing/other), Q10 columns |
| settings | key-value |
| code_numberings | supplier codes |

## Steps

1. **dbml** - new module; drop `procurement.suppliers`, target-only
   `supplier_contacts`/`supplier_addresses`; re-point references in
   procurement, finance (`supplier_bills`, `ap_open_items`), inventory
   (`items.supplier_id`), payment counterparty.
2. **Drizzle** - `supplier.schema.ts`; remove suppliers from
   `procurement.schema.ts`.
3. **Repositories** - company, supplier, address, company-address, setting,
   code-numbering.
4. **Services** - `SupplierCompanyService`, `SupplierService`;
   `ExportedSupplierService`: `assertActiveCompany`, `getPurchaseSnapshot`
   (name, address, NPWP, PIC for PO print), `getBankDetails` (permission
   checked by caller).
5. **Controllers** - `/suppliers/companies`, `/suppliers/people` (PIC),
   `/suppliers/companies/:id/addresses`.
6. **Consumers** - web-admin supplier pages move from `procurement-api.ts` to a
   new `supplier-api.ts`; PO form picks company then PIC.

## Exit

PO creation still prints the supplier block; bank details stay hidden without
the permission (test).
