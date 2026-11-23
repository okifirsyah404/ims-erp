CREATE TABLE "human_resource"."schedules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"shift_start" varchar(5),
	"shift_end" varchar(5),
	"shift_label" text,
	"is_day_off" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "schedules_shift_check" CHECK ((is_day_off AND shift_start IS NULL AND shift_end IS NULL) OR (NOT is_day_off AND shift_start IS NOT NULL AND shift_end IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_employee_date_uq" ON "human_resource"."schedules" ("employee_id","work_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_work_date_idx" ON "human_resource"."schedules" ("work_date");--> statement-breakpoint
ALTER TABLE "human_resource"."schedules" ADD CONSTRAINT "schedules_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "human_resource"."employees"("id") ON DELETE RESTRICT;