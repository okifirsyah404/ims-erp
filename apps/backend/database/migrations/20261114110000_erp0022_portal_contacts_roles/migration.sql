-- ERP-0022: one portal login per customer contact, with a role
-- (owner decisions D1/D2, 2026-11-14, after the website gap analysis).
-- Hand-written, append-only; follows 20261114100000_erp0022_customer_portal.
--
-- contact_id: logical reference to crm.customer_contacts.id (no FK, nullable,
-- ADR-0014). portal_role: owner | approver | finance | viewer. The unique
-- live index moves from the customer to the contact; several contacts of one
-- customer may each have a login. Existing rows (none outside disposable
-- databases) keep contact_id NULL and become owners.

ALTER TABLE "auth"."portal_identities" ADD COLUMN IF NOT EXISTS "contact_id" uuid;
ALTER TABLE "auth"."portal_identities" ADD COLUMN IF NOT EXISTS "portal_role" text NOT NULL DEFAULT 'owner';
ALTER TABLE "auth"."portal_identities" DROP CONSTRAINT IF EXISTS "portal_identities_portal_role_check";
ALTER TABLE "auth"."portal_identities" ADD CONSTRAINT "portal_identities_portal_role_check"
	CHECK ("portal_role" IN ('owner', 'approver', 'finance', 'viewer'));

DROP INDEX IF EXISTS "auth"."portal_identities_entity_uq";
DROP INDEX IF EXISTS "auth"."portal_identities_linked_entity_id_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "portal_identities_contact_uq"
	ON "auth"."portal_identities" ("portal_type", "contact_id") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS "portal_identities_entity_idx"
	ON "auth"."portal_identities" ("portal_type", "linked_entity_id");
