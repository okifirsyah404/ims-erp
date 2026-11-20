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
	"national_id" varchar(32),
	"email" varchar(320),
	"phone" varchar(100),
	"whatsapp" varchar(100),
	"photo_object_key" text,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"employment_type" text DEFAULT 'permanent' NOT NULL,
	"work_type" text DEFAULT 'onsite' NOT NULL,
	"hire_date" bigint,
	"termination_date" bigint,
	"manager_employee_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "hr_employees_employment_status_check" CHECK ("employment_status" IN ('active', 'inactive', 'terminated')),
	CONSTRAINT "hr_employees_employment_type_check" CHECK ("employment_type" IN ('permanent', 'contract', 'probation', 'internship', 'outsourced')),
	CONSTRAINT "hr_employees_work_type_check" CHECK ("work_type" IN ('onsite', 'remote', 'hybrid'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hr_employees_code_uq" ON "hr"."employees" ("organization_id","employee_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "hr_employees_user_uq" ON "hr"."employees" ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "hr_employees_organization_idx" ON "hr"."employees" ("organization_id");--> statement-breakpoint
CREATE INDEX "hr_employees_user_idx" ON "hr"."employees" ("user_id");--> statement-breakpoint
CREATE INDEX "hr_employees_full_name_idx" ON "hr"."employees" ("full_name");--> statement-breakpoint
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_manager_employee_id_employees_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "hr"."employees"("id") ON DELETE SET NULL;
