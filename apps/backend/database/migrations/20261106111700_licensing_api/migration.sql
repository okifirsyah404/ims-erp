CREATE TABLE "licensing"."application_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"licensable_application_id" uuid NOT NULL,
	"api_key_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_start" varchar(20),
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"revoked_by" text,
	"revoked_at" bigint,
	"last_used_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "application_api_keys_status_check" CHECK ("status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "licensing"."license_activations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_key_id" uuid NOT NULL,
	"instance_id" varchar(200) NOT NULL,
	"device_name" varchar(200),
	"activated_at" bigint NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"last_ip" text,
	"status" text DEFAULT 'active' NOT NULL,
	"deactivated_at" bigint,
	"deactivated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "license_activations_status_check" CHECK ("status" IN ('active', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE "licensing"."license_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"license_key_id" uuid,
	"license_contract_id" uuid,
	"application_api_key_id" uuid,
	"event_type" text NOT NULL,
	"result" text NOT NULL,
	"instance_id" varchar(200),
	"ip_address" text,
	"actor_user_id" text,
	"description" text,
	"event_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "license_events_event_type_check" CHECK ("event_type" IN ('validated', 'activated', 'deactivated', 'renewed', 'suspended', 'reactivated', 'terminated', 'key_revoked'))
);
--> statement-breakpoint
CREATE INDEX "application_api_keys_application_id_idx" ON "licensing"."application_api_keys" ("licensable_application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_api_keys_api_key_id_uq" ON "licensing"."application_api_keys" ("api_key_id");--> statement-breakpoint
CREATE INDEX "license_activations_key_id_idx" ON "licensing"."license_activations" ("license_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_activations_active_uq" ON "licensing"."license_activations" ("license_key_id","instance_id") WHERE status = 'active' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "license_events_key_id_idx" ON "licensing"."license_events" ("license_key_id");--> statement-breakpoint
CREATE INDEX "license_events_contract_id_idx" ON "licensing"."license_events" ("license_contract_id");--> statement-breakpoint
CREATE INDEX "license_events_event_at_idx" ON "licensing"."license_events" ("event_at");--> statement-breakpoint
ALTER TABLE "licensing"."application_api_keys" ADD CONSTRAINT "application_api_keys_o1w5iIa8QWO5_fkey" FOREIGN KEY ("licensable_application_id") REFERENCES "licensing"."licensable_applications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_activations" ADD CONSTRAINT "license_activations_license_key_id_license_keys_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "licensing"."license_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_events" ADD CONSTRAINT "license_events_license_key_id_license_keys_id_fkey" FOREIGN KEY ("license_key_id") REFERENCES "licensing"."license_keys"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_events" ADD CONSTRAINT "license_events_license_contract_id_license_contracts_id_fkey" FOREIGN KEY ("license_contract_id") REFERENCES "licensing"."license_contracts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "licensing"."license_events" ADD CONSTRAINT "license_events_zNKYspG3nXkU_fkey" FOREIGN KEY ("application_api_key_id") REFERENCES "licensing"."application_api_keys"("id") ON DELETE RESTRICT;