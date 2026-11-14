CREATE TABLE "hr"."attendance_records" (
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
	CONSTRAINT "attendance_records_status_check" CHECK ("status" IN ('present', 'permit', 'sick', 'leave', 'absent', 'holiday')),
	CONSTRAINT "attendance_records_source_check" CHECK ("source" IN ('manual', 'import', 'leave')),
	CONSTRAINT "attendance_records_times_check" CHECK ("check_out_at" IS NULL OR "check_in_at" IS NULL OR "check_out_at" >= "check_in_at")
);
--> statement-breakpoint
CREATE TABLE "hr"."bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_holder" varchar(200) NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "hr"."employee_tasks" (
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
	CONSTRAINT "employee_tasks_status_check" CHECK ("status" IN ('open', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "hr"."leave_requests" (
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
	CONSTRAINT "leave_requests_status_check" CHECK ("status" IN ('submitted', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "leave_requests_dates_check" CHECK ("end_date" >= "start_date"),
	CONSTRAINT "leave_requests_days_check" CHECK ("days" > 0)
);
--> statement-breakpoint
CREATE TABLE "hr"."leave_types" (
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
	CONSTRAINT "leave_types_attendance_status_check" CHECK ("attendance_status" IN ('leave', 'sick', 'permit')),
	CONSTRAINT "leave_types_quota_check" CHECK ("annual_quota_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hr"."overtime_requests" (
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
	CONSTRAINT "overtime_requests_status_check" CHECK ("status" IN ('submitted', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "overtime_requests_hours_check" CHECK ("hours" > 0 AND "hours" <= 24)
);
--> statement-breakpoint
CREATE TABLE "hr"."salary_summaries" (
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
	CONSTRAINT "salary_summaries_status_check" CHECK ("status" IN ('draft', 'approved')),
	CONSTRAINT "salary_summaries_amounts_check" CHECK ("base_salary" >= 0 AND "allowances" >= 0 AND "overtime_pay" >= 0 AND "bonus" >= 0 AND "deductions" >= 0),
	CONSTRAINT "salary_summaries_net_check" CHECK ("net_pay" = "base_salary" + "allowances" + "overtime_pay" + "bonus" - "deductions")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_day_uq" ON "hr"."attendance_records" ("employee_id","attendance_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "attendance_records_date_idx" ON "hr"."attendance_records" ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendance_records_leave_request_id_idx" ON "hr"."attendance_records" ("leave_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_employee_uq" ON "hr"."bank_accounts" ("employee_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "employee_tasks_employee_id_idx" ON "hr"."employee_tasks" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_tasks_status_idx" ON "hr"."employee_tasks" ("status");--> statement-breakpoint
CREATE INDEX "leave_requests_employee_id_idx" ON "hr"."leave_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "hr"."leave_requests" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_code_uq" ON "hr"."leave_types" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "overtime_requests_employee_id_idx" ON "hr"."overtime_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "overtime_requests_work_date_idx" ON "hr"."overtime_requests" ("work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_summaries_period_employee_uq" ON "hr"."salary_summaries" ("period","employee_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "salary_summaries_period_idx" ON "hr"."salary_summaries" ("period");--> statement-breakpoint
CREATE INDEX "salary_summaries_employee_id_idx" ON "hr"."salary_summaries" ("employee_id");--> statement-breakpoint
ALTER TABLE "hr"."attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."attendance_records" ADD CONSTRAINT "attendance_records_leave_request_id_leave_requests_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "hr"."leave_requests"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."bank_accounts" ADD CONSTRAINT "bank_accounts_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."employee_tasks" ADD CONSTRAINT "employee_tasks_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "hr"."salary_summaries" ADD CONSTRAINT "salary_summaries_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT;