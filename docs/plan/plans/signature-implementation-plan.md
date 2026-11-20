> Historical plan written before ADR-0024; module and schema names below are the pre-refactor ones (see docs/database/module-ownership.md for the current mapping).

# Signature implementation plan (ERP-0048 / ERP-0049)

Status: **implemented** (2026-11-16 for requests/evidence/image; 2026-11-17 for
the signed-PDF placement). Evidence and commands: `docs/plan/progress.md`.
Design grilled and locked 2026-11-16 (13 decisions), extended 2026-11-17 with
the placement slice (D13 superseded).

## 1. Current state (verified 2026-11-16)

- `document.signatures` exists in `docs/database/docs.dbml` and
  `drizzle/schemas/document.schema.ts` but is **schema-only**: no repository
  methods, service methods, zod contracts or backend routes exist. The three
  `/documents/signatures/*` pages are three frontend `ComingSoonPage` stubs.
- Permission vocabulary and role grants are shipped and browser-verified
  (ERP-0062): `document:signature_read` (15 roles), `document:signature_request`
  (7 roles), `document:signature_sign` (15 roles). Backend route guards land with
  this flow.
- `document.signature_request_expiry_days` exists in the `document.*` settings
  group. Notification template `document.signatureRequested` exists in en+id
  locales but has no producer yet.
- `signer_type` = `internal | customer | partner`; `signature_method` =
  `electronic | wet_ink | stamp`; `signed_at` is NOT NULL; `certificate_serial`
  exists and stays unused.
- ERP-0048 (signature requests) and ERP-0049 (user signature image) are phantom
  backlog IDs — cited in code comments but absent from `backlog.md`. This work
  makes them real rows.
- Company signature/stamp image is a separate, working company-module feature
  (`company.profiles.signature_object_key`, `PUT/DELETE /company/profile/:kind`);
  its settings-page upload UI was removed in ERP-0045c. Printed document
  components already render it via a presigned `signatureUrl`.
- "PDF rendering" in this project means browser print (`window.print()` + print
  CSS) on six print routes: quotation, invoice, delivery note, BAST, warranty,
  purchase order. There is no PDF generator and none is added here.

Evidence: `docs/architecture/security-and-access.md` (§ signature flow note),
`docs/database/docs.dbml` (`document.signatures`),
`docs/plan/plans/2026-11-15_0538_todo_undone.md` (§3, §6), `docs/plan/progress.md`
(2026-11-16 ERP-0062 entry), and a code survey of `apps/backend/src/app/document`
and `apps/web-admin/src/routes/_authed/documents/signatures`.

## 2. Locked decisions

| # | Decision |
|---|---|
| D1 | New table `document.signature_requests`; `document.signatures` is **not changed** and stays immutable evidence. |
| D2 | Internal signers only in V1 (`signer_type` always `internal`). Customer/partner via public token link is a later slice; the column and the `document.shares` token pattern are the upgrade path. |
| D3 | Signing methods: `electronic` (click) plus self-recorded `wet_ink` / `stamp` ("I signed physically"). |
| D4 | Parallel signing. No `order_index`. |
| D5 | Expiry: default from `document.signature_request_expiry_days`, read by the **backend**; per-request override; NULL = no expiry. Expiry computed at read time (lazy), no cron job. |
| D6 | Notifications in-app: `requested` → signers, `signed` / `declined` → requester. New template keys `signatureSigned` / `signatureDeclined` in en+id; `signatureRequested` already exists. |
| D7 | User signature image is **in scope** (ERP-0049): upload / preview / delete on the Mine page, stored in `document.user_signatures`. V1 = profile asset; rendering into print layouts is V1.5. |
| D8 | All document types in the registry can be signed. Type filtering is UI-only. |
| D9 | Lifecycle: decline with reason, requester cancels while pending, re-request creates a new row. Statuses: `pending / signed / declined / expired / cancelled`. |
| D10 | UI: three signature pages plus a Signatures tab on `/documents/$documentId`. |
| D11 | Wet-ink/stamp recording is done by the signer themselves, never "on behalf of". |
| D12 | V1 includes a batch lookup endpoint for signers' images; rendering `<img>` into print components is a separate V1.5 slice (BAST and quotation first). |
| D13 | ~~No PDF library~~ **Superseded 2026-11-17 by the signed-PDF slice**: `pdfjs-dist` + `pdf-lib` are used *only* on the placement page, to render an uploaded PDF and embed the signature image. Print browser stays the default PDF mechanism; no server-side PDF generation. |

## 3. Database contract — canonical `docs.dbml` first

`docs/database/docs.dbml` is edited before any Drizzle file. Then, in this exact
order: `bun docs/database/gen-logical-references.ts` →
`bun docs/database/validate-dbml.ts` (must print OK) → Drizzle schemas → migration.

### 3.1 `document.signature_requests` (new)

- `id` uuid pk default `uuidv7()`; `organization_id` text nullable (logical ref
  to `auth.organizations.id`, NULL = company-wide).
- `document_id` uuid NOT NULL — real intra-module FK to `document.documents.id`,
  `onDelete: cascade`, consistent with files/signatures/shares.
- `requested_by_user_id`, `signer_user_id` text NOT NULL — logical refs to
  `auth.users.id`, no cross-module FK; validated through the existing Identity
  contract the document module already uses for `uploaded_by_user_id`.
- `signer_name` text NOT NULL — name snapshot at request time, so later profile
  renames do not rewrite history.
- `status` text NOT NULL default `pending`, CHECK
  `IN ('pending','signed','declined','expired','cancelled')`.
- `note` text (requester message), `decline_reason` text, `expires_at` bigint
  nullable (unix ms), `responded_at` bigint nullable.
- Standard `created_at` / `updated_at` / `deleted_at` unix-ms columns (soft delete).
- Indexes: `document_id`; `(signer_user_id, status)`; `(requested_by_user_id)`;
  **partial unique** `(document_id, signer_user_id) WHERE status = 'pending' AND
  deleted_at IS NULL` (blocks duplicate pending requests; re-request requires a
  terminal previous request).

### 3.2 `document.user_signatures` (new)

- `id`, nullable `organization_id`, `user_id` text NOT NULL (logical ref),
  `object_key` text NOT NULL (WebP in object storage), `uploaded_at` bigint,
  timestamps + `deleted_at`.
- Partial unique `user_id WHERE deleted_at IS NULL` — one image per user.

### 3.3 Migration

Hand-written append-only migration (generate/migrate scripts are blocked on main
per AGENTS.md), one step for both tables. Apply with
`database/migrate-reset.ts` against a disposable DB; seeders unchanged (no new
reference data). `docs/database/logical-references.md` regenerated; it gains the
two request rows and the image row.

## 4. Backend — `apps/backend/src/app/document/`

New files following the module shape: `contracts/signature.contract.ts` (zod +
view types), `contracts/signature.repository.interface.ts`,
`repositories/signature.repository.ts`, `services/signature.service.ts`,
`errors/signature.errors.ts` (`SignatureRequestNotFoundError`,
`SignatureRequestStateError`, `NotRequestSignerError`,
`SignatureImageNotFoundError`). Add DI tokens in `constants/di.ts`, register in
`container.ts`; routes go in the existing controller (`domainPlugin`, `guards:
'erp'`).

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | `/documents/signatures` | `signature_read` | Signature evidence register; filter by document/method/date; paginated. |
| GET | `/documents/signatures/requests/incoming` | `signature_sign` | Requests addressed to caller (pending + history). |
| GET | `/documents/signatures/requests/outgoing` | `signature_request` | Requests caller created. |
| POST | `/documents/signatures/requests` | `signature_request` | `{documentId, signerUserIds[1..20], note?, expiresAt?}` — batch insert; default expiry from setting. |
| POST | `/documents/signatures/requests/:id/sign` | `signature_sign` | Must be addressed to caller, status pending, not expired. Body `{method}` (default `electronic`). Insert `document.signatures` (`signer_type='internal'`, name from session, `signed_at` = server now, `ip_address` from request) and mark request `signed`. |
| POST | `/documents/signatures/requests/:id/decline` | `signature_sign` | `{reason}` → `declined`. |
| POST | `/documents/signatures/requests/:id/cancel` | `signature_request` | Requester only; pending only → `cancelled`. |
| GET | `/documents/:id/signatures` | `signature_read` | Evidence + requests for one document (detail-tab data). |
| GET / PUT / DELETE | `/documents/signatures/my-image` | `signature_sign` | Multipart ≤2 MB via `storeDocumentImage` → WebP; presigned GET (1 h); DELETE soft-deletes the row. |
| POST | `/documents/signatures/user-images` | `signature_sign` | `{userIds}` → `[{userId, imageUrl}]` presigned for print pages (D12). |

Service rules:

- Pending queries always include `(expires_at IS NULL OR expires_at > now)`;
  stale pending rows are treated as expired without a write or a job.
- Caller identity and ownership are checked server-side on sign/decline/cancel;
  frontend permission checks are UX only.
- Notifications go through the notification module's contract via DI token,
  never a direct import of another module's repository.
- Reuse `IObjectStorage`, `storeDocumentImage`, `documentImageUrl` from
  `src/providers/s3/`; do not invent a second storage port.
- `certificate_serial` is left NULL; no PKI in V1.

## 5. Web admin

- New `lib/signature-api.ts` (pattern: `document-api.ts`, sends
  `x-organization-id`).
- `/documents/signatures/documents`: evidence table (document, signer, method
  badge, signed-at, IP) with filters and URL-driven pagination.
- `/documents/signatures/request`: create form (pick registry document, multi
  user picker from the existing users API, note, optional expiry with the
  server default shown as placeholder) + "Sent by me" list with status badges
  and cancel action.
- `/documents/signatures/mine`: personal image card (upload/preview/delete) +
  incoming requests (Sign with method choice / Decline with reason) + own
  signing history.
- `/documents/$documentId`: Signatures tab (evidence + requests + shortcut to
  request) — backend and `routeTree.gen.ts` regenerated in the same change.
- Locales: every user-facing string in both `en` and `id`; follow the namespace
  used by existing document pages, or add a `signatures` namespace with
  `i18next.d.ts` augmentation. Parity, no-empty and dead-key guards must pass.

## 6. PDF / rendering

Print browser (`window.print()` + print CSS) remains the default PDF mechanism
for documents whose layout the app owns. The **signed-PDF slice** (added
2026-11-17) handles a different case: a PDF the user uploaded to
`document.files`. There the signer places their signature on the real PDF:

- Browser only: `pdfjs-dist` renders the page to a canvas at a fixed scale,
  `pdf-lib` embeds the signature as PNG and returns the finished bytes.
  No server-side renderer, no headless Chromium.
- Both libraries are imported by the placement route alone.
- The server stores the artifact and refuses a second placement; it never
  stamps anything itself.

Still out of scope: generating a PDF from the app's own HTML layouts
(`pdfmake` remains the candidate if an automatic PDF file is ever required
server-side, e.g. for WhatsApp or the customer portal).

## 7. Tests and gates

- Backend unit tests: sign by wrong user / already signed / expired / success;
  cancel by non-requester; duplicate pending request; notification calls; image
  upload/delete; lazy expiry. Authorization test per new route (existing
  `test/authorization/authorization.test.ts` pattern).
- Web-admin tests for the list/form pages; locale parity and dead-key guards.
- Verify: `bun run lint`, `bun run test` (all workspaces), typechecks,
  `bun docs/database/validate-dbml.ts` → OK, migration applied to a disposable
  DB, seed idempotence, and a browser walk-through of the three pages plus the
  detail tab (sign, decline, cancel, image upload).

## 8. Execution order

1. `docs.dbml` + generators + validator.
2. Hand-written migration, verify on a disposable DB.
3. Backend: contracts → repository → service → controller → notifications → tests.
4. Web admin: API client → three pages + detail tab → locales → tests.
5. Browser verification of the full lifecycle.
6. Docs ledger updates (§10).

## 9. Out of scope / upgrade path

- Generating a PDF from the app's own HTML layouts (the signed-PDF slice only
  stamps an uploaded PDF).
- External signers via public token link (portal/customer) — `signer_type` and
  the `document.shares` token pattern are the upgrade path.
- Drawing the signature on a canvas at signing time (slice 2 of the image
  question; today the signer uploads an image and reuses it).
- `certificate_serial` / PKI, ordered signing, manual reminders — add on demand.
- Re-placing a signature on a PDF: placement is final by design (a second
  attempt answers 409); a mistake means a new signature request.

## 10. Docs ledger updates (same change as the code)

- `docs/plan/backlog.md`: materialize ERP-0048 and ERP-0049 with real status and
  evidence; remove their phantom-ID note.
- `docs/plan/progress.md`: dated entry with exact commands and outcomes; refresh
  "Next executable task" when work stops.
- `docs/plan/plans/features.md`: feature rollup follows the backlog status move.
- `docs/architecture/security-and-access.md`: remove the "signature flow not
  built" note; record the guard per route.
- `docs/database/`: updated per §3 before code; `validate-dbml.ts` must print OK.
