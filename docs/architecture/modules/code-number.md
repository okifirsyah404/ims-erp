# Code Number Module

> Created 2026-11-13 (ERP-0042, ADR-0015). Reflects
> `apps/backend/src/app/code-number` and the `/settings/code-numbers` page of
> web-admin. Supersedes the numbering sections of the Organization module doc.

## Purpose and boundary

The single numbering authority of the ERP: one series per code type for the
whole company, pattern-driven, collision-safe (ADR-0013). Every business
document that carries a human-readable code gets it here - quotations, sales
orders, invoices, receipts, purchase orders, goods receipts, delivery notes,
projects, BAST, warranty certificates, service tickets, journal entries,
payments, coins, item codes.

Before ERP-0042 the table was `organization.document_sequences` and the service
was `NumberingService`, owned by Organization. The rename is verbatim and the
decision is unchanged; only the name and the owner moved.

**Does not own** the documents it numbers. It allocates a string and returns it;
the calling module writes the document row in the same transaction.

## Data ownership

One table: `code_number.series`.

| Column | Meaning |
|---|---|
| `module` | the owning module of the code type (`sales`, `finance`, ...) |
| `code_type` | the code type; was `document_type` before ERP-0042 |
| `pattern` | token template, `NULL` means "use the code default" |
| `reset_policy` | `never` / `yearly` / `monthly`, `NULL` means the code default |
| `period_key` | the reset bucket currently in use (`2026`, `2026-11` or `all`) |
| `next_number` | the next sequence value to hand out |
| `last_issued_at`, `updated_by` | audit columns |

Unique on `(code_type)` for the whole company - there is no `organization_id`,
so two departments cannot end up with two independent invoice sequences. That
is the whole point of ADR-0013.

The 32 code types and their type tokens live in code, not in a table
(`domain/code-number.ts`): `CODE_TYPE_CODES` maps `quotation → QT`,
`sales_invoice → INV`, `bast → BAST`, `item_product → PRD`, `item_material →
MAT`, `item_component → CMP`, `warehouse → WH`, and so on. `CODE_TYPE_MODULES`
maps each type to its owning module and is written into the series row.

## Exported contract

```ts
next(codeType, { date?, context?, tx? }): Promise<string>
```

- **Allocation is one statement.** `INSERT ... ON CONFLICT DO UPDATE ...
  RETURNING next_number` on the live unique index. There is no read-then-write
  window, so two concurrent callers cannot receive the same number; the
  returned value is the stored value minus one after the increment. Verified
  under concurrency: 50 simultaneous allocations produced 50 distinct numbers
  on PostgreSQL.
- **`tx` is required in practice** for gap-free types (invoices, receipts): the
  caller passes its own transaction and calls `next` only when the document is
  actually issued, so a rolled-back write takes its number with it.
- **`date`** is the business date, not the wall clock: it decides `{MM}`,
  `{YY}`, `{YYYY}` and the reset bucket. Defaults to today in Asia/Jakarta.
- **`context`** supplies the non-sequential tokens: `{SUPPLIER}`, `{CATEGORY}`
  (purchase orders) and `{CUSTOMER}` (warranty certificates).
- **Numbers are never recomputed.** Editing a pattern only affects numbers
  issued afterwards. An issued number is a fact and stays as printed.

### Tokens

`{SEQ}`, `{SEQ:4}` (zero-padded), `{TYPE}`, `{COMPANY}`, `{MM}`, `{MM_ROMAN}`,
`{YY}`, `{YYYY}`, `{SUPPLIER}`, `{CATEGORY}`, `{CUSTOMER}`. `validatePattern`
rejects unknown tokens and a pattern with no `{SEQ}` at all (two documents of
one type would otherwise share a number). The settings page renders a preview
with `PREVIEW_CONTEXT` so an invalid pattern is caught before it is saved.

### Defaults

| Constant | Value |
|---|---|
| `DEFAULT_PATTERN` | `{SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}` |
| `WEB_REFERENCE_PATTERN` | `{TYPE}-{YYYY}-{SEQ:5}` |
| `PURCHASE_ORDER_PATTERN` | `{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}` |
| `BAST_PATTERN` | `{SEQ:3}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YYYY}` |
| `WARRANTY_PATTERN` | `{SEQ:3}/{TYPE}/{COMPANY}-{CUSTOMER}/{YYYY}` |

Reset defaults: `monthly` for purchase orders, `never` for employees and the
item codes, and `yearly` for the rest, unless the inventory pattern table
(`INVENTORY_PATTERNS`) defines its own reset for that type.

## `{COMPANY}` comes from Company

The `{COMPANY}` token is `company.profiles.document_code`, read through
`ICompanyService.getProfile(tx)`. A missing profile raises
`CompanyProfileRequiredError` rather than rendering an empty token - a document
numbered `0001/QT//XI/26` is worse than a failed save. The settings page shows
the same error as "Fill in the company profile first".

## Item codes (ERP-0043)

Item codes are allocated here too, as three separate code types so each kind has
its own sequence: `item_product → PRD`, `item_material → MAT`,
`item_component → CMP`. The Inventory and Assets modules call `next` at create
time and store the result in `inventory.items.code`, which is then immutable.
Assets are `code` + `serial_number`; items are `code` + `sku` (plus an optional
`serial_number` when serialized).

## API

Prefix `/code-numbers`, guard `erp`:

| Route | Permission | Notes |
|---|---|---|
| `GET /code-numbers` | `code_number:read` | one row per code type with the effective pattern, reset policy, `isDefault` and the next number (a preview, not a reservation) |
| `POST /code-numbers/:codeType/preview` | `code_number:read` | renders a candidate pattern against `PREVIEW_CONTEXT` without saving |
| `PUT /code-numbers/:codeType` | `code_number:update` | saves pattern and/or reset policy; rejects an invalid pattern |

Permissions are `code_number:read` / `code_number:update`, replacing the old
`company_setting:*` pair.

## Tests

`test/unit/code-number.service.test.ts` - 9 tests in two suites: pattern rules
(token validation, the mandatory `{SEQ}`, rendering and padding) and the service
(defaults when no row exists, the stored override winning, the `{COMPANY}`
lookup, and the collision-safety contract against a mocked allocator). The
50-concurrent-allocation check runs against PostgreSQL as an integration test.
