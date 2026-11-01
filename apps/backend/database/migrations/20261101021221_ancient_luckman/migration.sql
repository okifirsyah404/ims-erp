CREATE TABLE "auth"."roles" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"rank" integer NOT NULL,
	"permissions" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_invitations" (
	"id" text PRIMARY KEY,
	"type" text DEFAULT 'app' NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"organization_id" text,
	"role_id" text,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"resent_count" integer DEFAULT 0 NOT NULL,
	"delivery_failed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_name_live_idx" ON "auth"."roles" ("organization_id","name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "roles_organizationId_idx" ON "auth"."roles" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_invitations_token_hash_idx" ON "auth"."user_invitations" ("token_hash");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "auth"."user_invitations" ("email");--> statement-breakpoint
CREATE INDEX "user_invitations_organizationId_idx" ON "auth"."user_invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "user_invitations_status_idx" ON "auth"."user_invitations" ("status");--> statement-breakpoint
ALTER TABLE "auth"."roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" ADD CONSTRAINT "user_invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" ADD CONSTRAINT "user_invitations_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth"."user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;