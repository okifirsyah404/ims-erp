CREATE TABLE "project"."site_attendances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"business_date" date NOT NULL,
	"check_in_at" bigint NOT NULL,
	"check_out_at" bigint,
	"latitude" numeric(10,7) NOT NULL,
	"longitude" numeric(10,7) NOT NULL,
	"accuracy_meters" numeric(8,2),
	"check_out_latitude" numeric(10,7),
	"check_out_longitude" numeric(10,7),
	"distance_meters" numeric(10,2) NOT NULL,
	"radius_meters" integer NOT NULL,
	"status" text NOT NULL,
	"selfie_key" text NOT NULL,
	"selfie_content_type" varchar(100) NOT NULL,
	"note" varchar(500),
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "site_attendances_status_check" CHECK (status IN ('verified', 'out_of_range')),
	CONSTRAINT "site_attendances_distance_check" CHECK (distance_meters >= 0 AND radius_meters > 0),
	CONSTRAINT "site_attendances_times_check" CHECK (check_out_at IS NULL OR check_out_at >= check_in_at),
	CONSTRAINT "site_attendances_coordinates_check" CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE INDEX "site_attendances_project_date_idx" ON "project"."site_attendances" ("project_id","business_date");--> statement-breakpoint
CREATE INDEX "site_attendances_employee_date_idx" ON "project"."site_attendances" ("employee_id","business_date");--> statement-breakpoint
CREATE INDEX "site_attendances_organization_id_idx" ON "project"."site_attendances" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_attendances_day_uq" ON "project"."site_attendances" ("project_id","employee_id","business_date") WHERE deleted_at IS NULL;
