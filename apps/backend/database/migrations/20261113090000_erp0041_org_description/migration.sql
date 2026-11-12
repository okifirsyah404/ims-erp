-- ERP-0041: optional free-text organization description.
-- Hand-written (append-only; follows the hand-written migration convention
-- of 20261112120000 and 20261112150000 - no snapshot.json, the repo carries
-- no drizzle-kit journal).
--
-- `text` with no length limit is the storage decision; the 2000-char cap is a
-- boundary rule enforced by the zod contract at the HTTP edge, so widening it
-- later does not need a migration.
ALTER TABLE "auth"."organizations"
	ADD COLUMN IF NOT EXISTS "description" text;
