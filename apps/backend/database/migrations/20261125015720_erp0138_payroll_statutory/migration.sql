ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "pph21_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "bpjs_employee_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "bpjs_company_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "pension_employee_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "taxable_gross" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "ptkp_status" varchar(5);--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "ter_rate" numeric(7,4);--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "tax_method" text;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD COLUMN "journal_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD CONSTRAINT "employee_salary_records_statutory_check" CHECK (bpjs_employee_amount >= 0 AND bpjs_company_amount >= 0 AND pension_employee_amount >= 0 AND taxable_gross >= 0);--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" ADD CONSTRAINT "employee_salary_records_tax_method_check" CHECK (tax_method IS NULL OR tax_method IN ('ter', 'annual'));--> statement-breakpoint
ALTER TABLE "human_resource"."employee_salary_records" DROP CONSTRAINT "employee_salary_records_net_check", ADD CONSTRAINT "employee_salary_records_net_check" CHECK (net_pay = base_salary + allowances + overtime_pay + bonus - deductions - pph21_amount - bpjs_employee_amount);