CREATE TABLE "human_resource"."employee_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"kind" text DEFAULT 'residence' NOT NULL,
	"address_line" text NOT NULL,
	"village_id" uuid,
	"postal_code" varchar(10),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_addresses_kind_check" CHECK (kind IN ('residence', 'current', 'birth', 'other'))
);
--> statement-breakpoint
CREATE INDEX "employee_addresses_employee_id_idx" ON "human_resource"."employee_addresses" ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_addresses_primary_uq" ON "human_resource"."employee_addresses" ("employee_id") WHERE is_primary AND deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_addresses" ADD CONSTRAINT "employee_addresses_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;