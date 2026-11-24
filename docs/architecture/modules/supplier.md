# Supplier Module

> Rewritten 2026-11-20 (ADR-0024). The previous page was the NestJS-era
> scaffold audit of the supplier master that lived inside procurement; the
> supplier master is now its own module and schema.

Code: `apps/backend/src/app/supplier`. Schema: `supplier`. Ownership profile:
`docs/database/module-ownership.md` (#5). Tables: `docs/database/docs.dbml`.

## Purpose and boundary

Supplier/vendor master data, split out of `procurement`. It owns the B2B
supplier company and its people (PIC); it does not own purchase documents
(`procurement`) or supplier bills and payments (`finance`, `payment`).

## Owned tables (6)

`companies` (the supplier company), `suppliers` (the people/PIC),
`addresses`, `company_addresses`, `settings`, `code_numberings`
(`SupplierNumberingService`, ADR-0024 Q32). Addresses store only `village_id`;
the rest of the path is derived through `ExportedLocationService`.

`companies.supplier_type` is `company | government | individual`;
`companies.image_object_key` holds the single supplier photo (presigned on
read through `SupplierImageService`).

## HTTP

Prefix `/suppliers` (`erp` guard): `GET|POST /companies`,
`GET|PATCH /companies/:id`, `POST /companies/:id/activate|deactivate`,
`PUT|DELETE /companies/:id/image` (multipart `file`, WebP, `supplier:update`),
`GET|POST /people`, `PATCH|DELETE /people/:id` (soft delete).

## Contract

`ExportedSupplierService` (`EXPORTED_SUPPLIER_SERVICE_TOKEN`,
repository-only facade): `assertActiveCompany`, `findCompanyByCode`,
`findPerson`, `getPurchaseSnapshot`, `getBankDetails`. `procurement` and
`finance` consume it; nobody reads `supplier.*` tables directly.

## Permissions

Resource `supplier`: `read`, `create`, `update`, `archive`, `read_bank`.

## Rules

- Bank details are restricted: only holders of `supplier:read_bank` see them;
  lists never include them.
- Documents snapshot supplier data at creation (`getPurchaseSnapshot`).
- Cross-module references to suppliers are plain nullable id columns,
  checked by `assertActiveCompany` before the write (ADR-0014).
- Soft delete only; a supplier referenced by purchase or finance documents is
  never hard-deleted.
- An `individual` supplier has no legal name and no NPWP (the UI hides and
  clears both); the schema still allows them, so a type switch loses nothing.
- The code is editable but always upper-cased and unique among live rows; an
  empty code on create is generated from `supplier.code_numberings`.
- One photo per company (`image_object_key`); a replacement stores a fresh key
  so nothing that snapshotted the old one breaks.
