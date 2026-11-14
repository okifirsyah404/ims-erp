-- ERP-0022 customer portal, stage 1 (M07 T26 + the account part of M12 T25).
-- Hand-written, append-only (same convention as 20261113090000: no
-- snapshot.json, the repo carries no drizzle-kit journal).
--
-- 1. auth.portal_identities: an ERP-owned extension table in the auth schema
--    (like auth.user_invitations). linked_entity_id is a logical reference to
--    crm.customers.id for portal_type 'customer' — no foreign key, nullable
--    (ADR-0014). One live identity per customer and per user.
-- 2. aftersales.service_ticket_comments: the ticket's message thread
--    (staff internal notes, staff replies and customer messages), company-wide
--    like the ticket.
-- 3. aftersales.service_tickets: channel / confirmation_channel gain 'portal'.

CREATE TABLE IF NOT EXISTS "auth"."portal_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" text NOT NULL,
	"portal_type" text NOT NULL,
	"linked_entity_id" uuid,
	"status" text NOT NULL DEFAULT 'active',
	"created_by" text,
	"last_login_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "portal_identities_user_id_users_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
	CONSTRAINT "portal_identities_portal_type_check"
		CHECK ("portal_type" IN ('customer', 'investor', 'partner', 'technician')),
	CONSTRAINT "portal_identities_status_check"
		CHECK ("status" IN ('active', 'suspended', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "portal_identities_user_id_uq"
	ON "auth"."portal_identities" ("user_id") WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "portal_identities_entity_uq"
	ON "auth"."portal_identities" ("portal_type", "linked_entity_id") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS "portal_identities_linked_entity_id_idx"
	ON "auth"."portal_identities" ("linked_entity_id");

CREATE TABLE IF NOT EXISTS "aftersales"."service_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"service_ticket_id" uuid NOT NULL,
	"author_type" text NOT NULL DEFAULT 'staff',
	"author_user_id" text,
	"author_name" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"visibility" text NOT NULL DEFAULT 'internal',
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "service_ticket_comments_service_ticket_id_service_tickets_id_fkey"
		FOREIGN KEY ("service_ticket_id") REFERENCES "aftersales"."service_tickets"("id") ON DELETE CASCADE,
	CONSTRAINT "service_ticket_comments_visibility_check"
		CHECK ("visibility" IN ('internal', 'customer')),
	CONSTRAINT "service_ticket_comments_author_type_check"
		CHECK ("author_type" IN ('staff', 'customer')),
	CONSTRAINT "service_ticket_comments_customer_visible_check"
		CHECK ("author_type" = 'staff' OR "visibility" = 'customer')
);

CREATE INDEX IF NOT EXISTS "service_ticket_comments_ticket_created_idx"
	ON "aftersales"."service_ticket_comments" ("service_ticket_id", "created_at");

ALTER TABLE "aftersales"."service_tickets" DROP CONSTRAINT IF EXISTS "service_tickets_channel_check";
ALTER TABLE "aftersales"."service_tickets" ADD CONSTRAINT "service_tickets_channel_check"
	CHECK ("channel" IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other'));
ALTER TABLE "aftersales"."service_tickets" DROP CONSTRAINT IF EXISTS "service_tickets_confirmation_channel_check";
ALTER TABLE "aftersales"."service_tickets" ADD CONSTRAINT "service_tickets_confirmation_channel_check"
	CHECK ("confirmation_channel" IS NULL OR "confirmation_channel" IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other'));
