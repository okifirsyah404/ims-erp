-- ERP-0036 Slice 4 (D15): rename the permission resource `borrowing` to `asset_borrowing`.
--
-- Grants live in `auth.roles.permissions` (jsonb) and the role seeder is
-- insert-only, so without this every organization silently loses borrowing
-- access after the code rename. Idempotent: a row that already has the new key
-- is left alone, and the old key is only removed in the same statement.
UPDATE "auth"."roles"
SET "permissions" = ("permissions" - 'borrowing') || jsonb_build_object('asset_borrowing', "permissions" -> 'borrowing')
WHERE "permissions" ? 'borrowing'
  AND NOT "permissions" ? 'asset_borrowing';--> statement-breakpoint

-- D14: the borrowing sequence key moves too. Keep the allocated number (do not
-- restart at 1) so already-printed codes are never minted again. If a target
-- row somehow exists, drop the stale source row instead of violating the
-- (organization_id, doc_type) primary key.
UPDATE "organization"."document_sequences" AS seq
SET "doc_type" = 'asset_borrowing'
WHERE seq."doc_type" = 'borrowing'
  AND NOT EXISTS (
    SELECT 1 FROM "organization"."document_sequences" AS existing
    WHERE existing."organization_id" = seq."organization_id"
      AND existing."doc_type" = 'asset_borrowing'
  );--> statement-breakpoint
DELETE FROM "organization"."document_sequences" AS seq
WHERE seq."doc_type" = 'borrowing'
  AND EXISTS (
    SELECT 1 FROM "organization"."document_sequences" AS existing
    WHERE existing."organization_id" = seq."organization_id"
      AND existing."doc_type" = 'asset_borrowing'
  );
