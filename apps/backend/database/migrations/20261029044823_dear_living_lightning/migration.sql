CREATE SCHEMA "sales";
--> statement-breakpoint
CREATE TABLE "sales"."payments" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"quotation_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" bigint,
	"executed_by" text,
	"executed_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales"."quotations" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_username_key" UNIQUE("username");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "sales"."payments" ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_quotation_idx" ON "sales"."payments" ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_org_code_uq" ON "sales"."quotations" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "quotations_org_idx" ON "sales"."quotations" ("organization_id");