-- ERP-0044 (3/3): public share links for the document registry.
-- Hand-written, append-only (same convention as 20261113120200).
--
-- A document can be shared outward with one opaque, revocable link. The token
-- is its own uuid column, never the row id: revoking a link revokes only that
-- link, and the id stays internal. The token is unique across every tenant
-- because the public route resolves it without a session.
--
-- `expires_at` stays nullable in the column (existing rows, future internal
-- share types are open-ended), but the service requires it for `public_link`.

ALTER TABLE "document"."shares"
	ADD COLUMN IF NOT EXISTS "token" uuid;

CREATE UNIQUE INDEX IF NOT EXISTS "shares_token_uq"
	ON "document"."shares" ("token")
	WHERE "deleted_at" IS NULL;

-- The public route looks a live, unrevoked link up by token on every hit.
CREATE INDEX IF NOT EXISTS "shares_token_live_idx"
	ON "document"."shares" ("token", "expires_at")
	WHERE "deleted_at" IS NULL AND "is_revoked" = false;
