CREATE SCHEMA "human_resource";
--> statement-breakpoint
CREATE TABLE "human_resource"."attendances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"status" text NOT NULL,
	"check_in_at" bigint,
	"check_out_at" bigint,
	"source" text DEFAULT 'manual' NOT NULL,
	"leave_request_id" uuid,
	"notes" text,
	"recorded_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "attendances_status_check" CHECK (status IN ('present', 'permit', 'sick', 'leave', 'absent', 'holiday')),
	CONSTRAINT "attendances_source_check" CHECK (source IN ('manual', 'import', 'leave')),
	CONSTRAINT "attendances_times_check" CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employee_salaries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"base_salary" bigint DEFAULT 0 NOT NULL,
	"fixed_allowances" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"bank_name" varchar(100),
	"bank_account_number" varchar(50),
	"bank_account_holder" varchar(200),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_salaries_base_check" CHECK (base_salary >= 0),
	CONSTRAINT "employee_salaries_allowances_check" CHECK (fixed_allowances >= 0),
	CONSTRAINT "employee_salaries_range_check" CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employee_salary_records" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"period" varchar(7) NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_name" text NOT NULL,
	"base_salary" bigint DEFAULT 0 NOT NULL,
	"allowances" bigint DEFAULT 0 NOT NULL,
	"overtime_pay" bigint DEFAULT 0 NOT NULL,
	"bonus" bigint DEFAULT 0 NOT NULL,
	"deductions" bigint DEFAULT 0 NOT NULL,
	"net_pay" bigint NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_salary_records_status_check" CHECK (status IN ('draft', 'approved')),
	CONSTRAINT "employee_salary_records_amounts_check" CHECK (base_salary >= 0 AND allowances >= 0 AND overtime_pay >= 0 AND bonus >= 0 AND deductions >= 0),
	CONSTRAINT "employee_salary_records_net_check" CHECK (net_pay = base_salary + allowances + overtime_pay + bonus - deductions)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employee_tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"done_at" bigint,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "employee_tasks_status_check" CHECK (status IN ('open', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "human_resource"."employees" (
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
	CONSTRAINT "employees_employment_status_check" CHECK (employment_status IN ('active', 'inactive', 'terminated')),
	CONSTRAINT "employees_employment_type_check" CHECK (employment_type IN ('permanent', 'contract', 'probation', 'internship', 'outsourced')),
	CONSTRAINT "employees_work_type_check" CHECK (work_type IN ('onsite', 'remote', 'hybrid')),
	CONSTRAINT "employees_termination_check" CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."code_numberings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code_type" varchar(32) NOT NULL,
	"pattern" varchar(100),
	"reset_policy" text,
	"period_key" varchar(7) NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "human_resource_code_numberings_reset_check" CHECK (reset_policy IS NULL OR reset_policy IN ('never', 'yearly', 'monthly')),
	CONSTRAINT "human_resource_code_numberings_next_check" CHECK (next_number > 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."settings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"value_type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "human_resource_settings_value_type_check" CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'date'))
);
--> statement-breakpoint
CREATE TABLE "human_resource"."leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"recorded_by" text,
	"decided_by" text,
	"decided_at" bigint,
	"decision_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "leave_requests_status_check" CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "leave_requests_dates_check" CHECK (end_date >= start_date),
	CONSTRAINT "leave_requests_days_check" CHECK (days > 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."leave_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"attendance_status" text DEFAULT 'leave' NOT NULL,
	"uses_quota" boolean DEFAULT false NOT NULL,
	"annual_quota_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "leave_types_attendance_status_check" CHECK (attendance_status IN ('leave', 'sick', 'permit')),
	CONSTRAINT "leave_types_quota_check" CHECK (annual_quota_days >= 0)
);
--> statement-breakpoint
CREATE TABLE "human_resource"."overtime_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"hours" numeric(5,2) NOT NULL,
	"reason" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"recorded_by" text,
	"decided_by" text,
	"decided_at" bigint,
	"decision_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "overtime_requests_status_check" CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "overtime_requests_hours_check" CHECK (hours > 0 AND hours <= 24)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_day_uq" ON "human_resource"."attendances" ("employee_id","attendance_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "attendances_date_idx" ON "human_resource"."attendances" ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendances_leave_request_id_idx" ON "human_resource"."attendances" ("leave_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salaries_period_uq" ON "human_resource"."employee_salaries" ("employee_id","effective_from") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employee_salaries_employee_id_idx" ON "human_resource"."employee_salaries" ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_records_period_uq" ON "human_resource"."employee_salary_records" ("period","employee_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employee_salary_records_period_idx" ON "human_resource"."employee_salary_records" ("period");--> statement-breakpoint
CREATE INDEX "employee_salary_records_employee_id_idx" ON "human_resource"."employee_salary_records" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_tasks_employee_id_idx" ON "human_resource"."employee_tasks" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_tasks_status_idx" ON "human_resource"."employee_tasks" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_org_code_uq" ON "human_resource"."employees" ("organization_id","employee_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_user_uq" ON "human_resource"."employees" ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employees_manager_employee_id_idx" ON "human_resource"."employees" ("manager_employee_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "human_resource"."employees" ("employment_status");--> statement-breakpoint
CREATE INDEX "employees_national_id_idx" ON "human_resource"."employees" ("national_id");--> statement-breakpoint
CREATE INDEX "employees_org_name_idx" ON "human_resource"."employees" ("organization_id","full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "human_resource_code_numberings_type_uq" ON "human_resource"."code_numberings" ("code_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "human_resource_settings_scope_uq" ON "human_resource"."settings" ("setting_group","setting_key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "leave_requests_employee_id_idx" ON "human_resource"."leave_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "human_resource"."leave_requests" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_code_uq" ON "human_resource"."leave_types" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "overtime_requests_employee_id_idx" ON "human_resource"."overtime_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "overtime_requests_work_date_idx" ON "human_resource"."overtime_requests" ("work_date");--> statement-breakpoint
ALTER TABLE "human_resource"."attendances" ADD CONSTRAINT "attendances_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."attendances" ADD CONSTRAINT "attendances_leave_request_id_leave_requests_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "human_resource"."leave_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD CONSTRAINT "employee_salary_records_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_tasks" ADD CONSTRAINT "employee_tasks_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."employees" ADD CONSTRAINT "employees_manager_employee_id_employees_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "human_resource"."leave_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "human_resource"."overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;