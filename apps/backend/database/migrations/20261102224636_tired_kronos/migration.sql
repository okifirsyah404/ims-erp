ALTER TABLE "auth"."users" ADD COLUMN "claimed_at" timestamp;

-- Backfill: users already active when this column shipped joined the
-- application at (or before) row creation — `created_at` is the best
-- available proxy for seeded/legacy accounts.
UPDATE "auth"."users" SET "claimed_at" = "created_at"
WHERE "status" = 'active' AND "claimed_at" IS NULL;