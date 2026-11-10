-- ERP-0034 Slice 1: hr.employees (minimal HR master data + warehouse PIC base).
-- Hand-written (see progress.md): the drizzle-kit journal has a pre-existing
-- two-branch conflict from the merge/main reconcile, so generate/migrate are
-- blocked; new migrations follow the custom-migration convention instead.
CREATE SCHEMA "hr";
--> statement-breakpoint
CREATE TABLE "hr"."employees" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"user_id" text,
	"employee_code" varchar(32) NOT NULL,
	"full_name" text NOT NULL,
	"legal_name" text,
	"nickname" text,
	"gender" text,
	"birth_date" timestamp with time zone,
	"birth_place" text,
	"national_id" varchar(32),
	"marital_status" text,
	"email" varchar(320),
	"phone" varchar(100),
	"whatsapp" varchar(100),
	"photo_object_key" text,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"employment_type" text DEFAULT 'permanent' NOT NULL,
	"work_type" text DEFAULT 'onsite' NOT NULL,
	"hire_date" timestamp with time zone,
	"termination_date" timestamp with time zone,
	"manager_employee_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hr_employees_manager_employee_id_employees_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "hr"."employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hr_employees_code_uq" ON "hr"."employees" USING btree ("organization_id","employee_code") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "hr_employees_user_uq" ON "hr"."employees" USING btree ("user_id") WHERE "user_id" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "hr_employees_organization_idx" ON "hr"."employees" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "hr_employees_user_idx" ON "hr"."employees" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "hr_employees_full_name_idx" ON "hr"."employees" USING btree ("full_name");
--> statement-breakpoint
ALTER TABLE "hr"."employees" ADD CONSTRAINT "hr_employees_employment_status_check" CHECK ("employees"."employment_status" IN ('active', 'inactive', 'terminated'));
--> statement-breakpoint
ALTER TABLE "hr"."employees" ADD CONSTRAINT "hr_employees_employment_type_check" CHECK ("employees"."employment_type" IN ('permanent', 'contract', 'probation', 'internship', 'outsourced'));
--> statement-breakpoint
ALTER TABLE "hr"."employees" ADD CONSTRAINT "hr_employees_work_type_check" CHECK ("employees"."work_type" IN ('onsite', 'remote', 'hybrid'));
