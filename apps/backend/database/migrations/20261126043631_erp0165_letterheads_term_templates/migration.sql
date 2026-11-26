CREATE TABLE "company"."letterheads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" varchar(100) NOT NULL,
	"header_object_key" text NOT NULL,
	"footer_object_key" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_term_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" varchar(100) NOT NULL,
	"payment_terms" varchar(500),
	"terms" text,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
ALTER TABLE "procurement"."purchase_orders" ADD COLUMN "letterhead_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "letterheads_default_uq" ON "company"."letterheads" ("is_default") WHERE deleted_at IS NULL AND is_default;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_term_templates_default_uq" ON "procurement"."purchase_term_templates" ("is_default") WHERE deleted_at IS NULL AND is_default;