# document - ERP-0085

Schema `document` · folder `src/app/document` · URL `/documents` · phase P7

## Current

Tables templates, documents, files, signatures, signature_requests,
user_signatures, access_logs, shares, tags, tag_links. Repositories document,
signature (each serves several tables). Controllers `/documents`,
`/documents/signatures`, `/public/v1/documents` (share links). Numbering via
`code_number`. Consumers: web-admin `documents-api.ts`, `signature-api.ts`,
`document-image-api.ts`.

## Target

Tables unchanged. New: `settings`, `code_numberings`. `documents.module`
values re-pointed to the new module names (`sale`, `project`, `ticket`, ...).
`numbering_pattern` on templates stays display-only.

## Steps

1. **dbml** - add the two tables; update module vocabulary note.
2. **Drizzle** - `document.schema.ts`.
3. **Repositories** - template, document, file, signature,
   signature-request, user-signature, access-log, share, tag, tag-link,
   setting, code-numbering.
4. **Services** - unchanged behaviour; numbering from own table.
5. **Controllers** - `/documents`, `/documents/signatures`,
   `/documents/public/v1/shares` (+ alias `/public/v1/documents`: share links
   already sent).
6. **Consumers** - the three wrappers' paths only.

## Exit

Share links via old and new URL resolve; signature tests green.
