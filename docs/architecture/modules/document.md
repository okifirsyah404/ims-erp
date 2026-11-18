# Document Module

> Created 2026-11-13 (ERP-0042, ADR-0015). Reflects
> `apps/backend/src/app/document` and the `/documents/*` routes of web-admin.
> Supersedes the Document sections of the old `documents` schema doc.

## Purpose and boundary

The issued-document registry plus everything attached to an issued document:
stored files, signature records, the read/download access trail, revocable
public share links, tags, and templates.

The boundary that matters: **the business document stays in its owning module.**
`sales.invoices` is the invoice; `document.documents` is the issued copy that
says "invoice number `0001/INV/IMS/XI/26` exists, was issued on this date, and
these are its files". Sales never loses ownership of its own table, and Document
never gains a second copy of the invoice's business columns.

Before ERP-0042 the schema was `documents` with `documents.*` table names, and
it sat inside the Organization module's scope. The schema is now `document` and
it is its own module.

**Does not own**: PDF rendering (out of scope; the web-admin renders documents
from its own React templates), the business document rows, number allocation
(Code Number), the letterhead (Company - read through
`ICompanyService.getProfile(tx)`).

## Data ownership

Eight tables in `document.*`:

| Table | Contents |
|---|---|
| `templates` | document templates with a `version`; a new version supersedes the old, a template is never hard-deleted |
| `documents` | the registry: `document_type`, `document_code` (allocated by Code Number), `source_type` + `source_id` (the business document it mirrors), `status`, `issued_on`, `issued_by_user_id`, `organization_id` |
| `files` | stored file metadata (object key, MIME, size, checksum). Bytes live in object storage; this module owns the metadata and the rules |
| `signatures` | signature records attached to a document (per-signer rows land here once ERP-0048 is built) |
| `access_logs` | one row per view or download, with actor, IP and user agent - append-only |
| `shares` | public share links: `token` (its own uuid column, not the document id), mandatory `expires_at`, `is_revoked` |
| `tags` / `tag_links` | free-form classification, many-to-many |

`organization_id` is **nullable** on every table: `NULL` means company-wide
(ADR-0011 pattern already used by Inventory and Assets). A document issued by a
department carries that department's id for filtering; the registry itself is
readable company-wide.

`source_type` + `source_id` is a logical reference (ADR-0014): no foreign key,
validated by the owning module before the write.

## Registry: `register` vs `issue`

Two entry points, deliberately different:

- **`issue(input, ...)`** allocates the code through Code Number and writes the
  registry row. Used when this module is the one that creates the document.
- **`register(input, tx?)`** writes the registry row for a document the calling
  module already created and numbered - usually inside the caller's own
  transaction. No allocation, no second transaction, no orphan on rollback.
  This is the path all the business modules use.

Both share one insert helper, so a registered and an issued row are identical in
shape and `status` (`issued`).

**`voidBySource(module, sourceType, sourceId, tx?)`** voids every live registry
row of one source document. A voided business document must never keep a live
copy in the registry. It is a no-op when the source was never registered (seeded
or pre-ERP-0044 data), so callers do not need to know which era a document is
from.

**`void(id, actorUserId)`** voids a single registry row and keeps it - nothing
is hard-deleted anywhere in this module.

Eleven document types are wired to `register` today: `quotation`, `sales_order`,
`sales_invoice`, `receipt`, `purchase_order`, `goods_receipt`, `delivery_note`,
`bast`, `warranty`, `service_ticket`, `license_contract` (ERP-0044). A document
type with no wiring simply never appears in the registry; the business document
still works.

## Files

Upload: multipart `file`, at most 10 MB, PDF or image. Delete is a **soft**
delete - the row stays for the trail, the object is not re-exposed. Download
returns a short-lived presigned URL and appends a `download` row to
`access_logs`; `detail(id, actorUserId)` appends a `view` row. The trail is
written by the reader, not by a background job, so it cannot drift from what
actually happened.

## Public share links (ERP-0044)

- The token is **its own uuid column** (`crypto.randomUUID()`), not the document
  id: a leaked link cannot be turned into an id to guess the rest. Unique across
  the table, with a live index on `(token, expires_at)`.
- `expires_at` is **mandatory** - `expiresInDays` defaults to 30 and is capped
  at 365 by the request schema. There is no "never expires" option.
- Revocable: `DELETE /documents/:id/shares/:shareId` sets `is_revoked`, and the
  row is kept so the trail stays readable.
- The public endpoint `GET /public/v1/documents/:token` is anonymous: no
  `erp` guard, no session. Authorization is the token plus the expiry and
  revocation checks on every request.
- The public view is a deliberately reduced shape: document type and code,
  issue date, the file list, and the company letterhead. **Never** the
  organization, the access trail, or internal ids.

## Generated files (ERP-0067)

`attachGeneratedFile(source, file, actorUserId | null)` stores a
system-made file (today the SPH PDF) on the **live registry row of a source
document**, found by `(module, source_type, source_id)`. It returns `null`
when the source was never registered (seeded or pre-ERP-0044 data) or is
void, and the caller then goes on without a file. The uploader may be null
(`uploaded_by_user_id` is nullable). A share is opened with the normal
`createShare` (the sharer may be null too), and
`GET /public/v1/documents/:token/file` sends the reader straight to the
newest file, so a chat message can carry one link to a PDF.

## API

Prefix `/documents`, guard `erp`:

| Route | Permission | Notes |
|---|---|---|
| `GET /documents` | `document:read` | the registry, newest first, paginated |
| `GET /documents/templates` | `document:read` | company-wide + tenant templates |
| `POST /documents/templates` | `document:update` | creates a template version |
| `GET /documents/:id` | `document:read` | one document with files, share links and trail; **appends a view row** |
| `POST /documents` | `document:update` | issues a document and allocates its code |
| `POST /documents/:id/void` | `document:update` | voids (the row is kept) |
| `POST /documents/:id/files` | `document:update` | attach a PDF or image (multipart, at most 10 MB) |
| `DELETE /documents/:id/files/:fileId` | `document:update` | soft delete |
| `GET /documents/:id/files/:fileId/download` | `document:download` | short-lived URL; appends a download row |
| `POST /documents/:id/shares` | `document:update` | a revocable public link with a mandatory expiry |
| `DELETE /documents/:id/shares/:shareId` | `document:update` | revokes (the row is kept) |
| `GET /public/v1/documents/:token` | none | the anonymous public read; no `erp` guard |
| `GET /public/v1/documents/:token/file` | none | ERP-0067: 302 to a 5-minute URL of the newest file; appends an anonymous download row |

Permissions are `document:read` / `document:create` / `document:update` /
`document:submit` / `document:approve` / `document:issue` / `document:void` /
`document:download`. Only the read, update and download actions are used by the
routes above today; the rest are registered in the catalog for the signature and
approval flows.

## Not built: signature requests (ERP-0048)

The design exists, the code does not. When it lands:

- `document.signature_requests` - one row per signer, with `status`
  (`waiting|requested|signed|declined|expired|cancelled`), `signing_order`,
  `mode` (sequential or parallel per request, default parallel) and `expires_at`.
- `document.signatures` gains `signature_request_id` and `signature_object_key`.
- `document.user_signatures` - a signer's saved signature images.
- A `notification` module for the in-app and email notifications.
- `sign` and `request_sign` added to the `document` resource.
- `document.signature_request_expiry_days` in `company.settings`, overridable
  per request.
- A document with a `signed` signature is **locked**: no further edits.
- The signature image is chosen by the signer at signing time - their own saved
  image or the company's.

Status `declined` in the DB is labelled "Rejected" / "Ditolak" in the UI. The
company's own signature image is **not** on `/settings/documents`: signatures
have their own module, and `/settings/documents` keeps only the letterhead logo.

## UI

- `/documents/files` - the registry and file list.
- `/documents/signatures/documents`, `/documents/signatures/request`,
  `/documents/signatures/mine` - placeholders for ERP-0048.
- `/documents/templates` - placeholder for ERP-0050.

## Tests

`test/unit/document.service.test.ts` - 12 tests in three suites: files (upload
metadata, soft delete, download URL), share links (uuid token, mandatory expiry,
revocation, the reduced public view), and detail (the view row being appended
and the assembled payload).
