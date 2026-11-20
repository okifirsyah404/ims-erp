CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" text PRIMARY KEY,
	"actor_user_id" text NOT NULL,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"organization_id" text,
	"meta" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit"."audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_idx" ON "audit"."audit_logs" ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit"."audit_logs" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit"."audit_logs" ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit"."audit_logs" ("target_type","target_id");
