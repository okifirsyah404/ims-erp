CREATE TABLE "aftersales"."service_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"service_ticket_id" uuid NOT NULL,
	"author_type" text DEFAULT 'staff' NOT NULL,
	"author_user_id" text,
	"author_name" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "service_ticket_comments_visibility_check" CHECK ("visibility" IN ('internal', 'customer')),
	CONSTRAINT "service_ticket_comments_author_type_check" CHECK ("author_type" IN ('staff', 'customer')),
	CONSTRAINT "service_ticket_comments_customer_visible_check" CHECK ("author_type" = 'staff' OR "visibility" = 'customer')
);
--> statement-breakpoint
CREATE TABLE "auth"."portal_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" text NOT NULL,
	"portal_type" text NOT NULL,
	"linked_entity_id" uuid,
	"contact_id" uuid,
	"portal_role" text DEFAULT 'owner' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"last_login_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "portal_identities_portal_type_check" CHECK ("portal_type" IN ('customer', 'investor', 'partner', 'technician')),
	CONSTRAINT "portal_identities_status_check" CHECK ("status" IN ('active', 'suspended', 'revoked')),
	CONSTRAINT "portal_identities_portal_role_check" CHECK ("portal_role" IN ('owner', 'approver', 'finance', 'viewer'))
);
--> statement-breakpoint
CREATE INDEX "service_ticket_comments_ticket_created_idx" ON "aftersales"."service_ticket_comments" ("service_ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_identities_user_id_uq" ON "auth"."portal_identities" ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_identities_contact_uq" ON "auth"."portal_identities" ("portal_type","contact_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "portal_identities_entity_idx" ON "auth"."portal_identities" ("portal_type","linked_entity_id");--> statement-breakpoint
ALTER TABLE "aftersales"."service_ticket_comments" ADD CONSTRAINT "service_ticket_comments_Zt41pz6B5eJe_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "aftersales"."service_tickets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."portal_identities" ADD CONSTRAINT "portal_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "aftersales"."service_tickets" DROP CONSTRAINT "service_tickets_channel_check", ADD CONSTRAINT "service_tickets_channel_check" CHECK ("channel" IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other'));--> statement-breakpoint
ALTER TABLE "aftersales"."service_tickets" DROP CONSTRAINT "service_tickets_confirmation_channel_check", ADD CONSTRAINT "service_tickets_confirmation_channel_check" CHECK ("confirmation_channel" IS NULL OR "confirmation_channel" IN ('phone', 'whatsapp', 'email', 'web', 'onsite', 'portal', 'other'));