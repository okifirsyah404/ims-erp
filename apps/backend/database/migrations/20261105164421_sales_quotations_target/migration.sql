-- ADR-0011 step 3c / implementation-phases.md S3: the scaffold
-- sales.quotations (text id, single integer amount, no items or customer) is
-- replaced, not altered. Its rows are scaffold test data with no customer or
-- items, so they are discarded. sales.payments is transitional: its text
-- quotation_id has no valid target after the recreation, so it is emptied
-- here and dropped in S7.
DELETE FROM "sales"."payments";--> statement-breakpoint
DROP TABLE "sales"."quotations";--> statement-breakpoint
CREATE TABLE "sales"."quotations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40) NOT NULL,
	"base_code" varchar(32) NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"previous_revision_id" uuid,
	"title" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_contact_id" uuid,
	"customer_snapshot" jsonb NOT NULL,
	"lead_id" uuid,
	"attention" varchar(200),
	"status" text DEFAULT 'draft' NOT NULL,
	"quotation_date" date NOT NULL,
	"valid_until" date,
	"payment_terms" varchar(300),
	"payment_schedule" jsonb,
	"guarantee" varchar(300),
	"vat_enabled" boolean DEFAULT true NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"notes" text,
	"terms" text,
	"created_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"rejected_reason" text,
	"sent_by" text,
	"sent_at" bigint,
	"closed_by" text,
	"closed_at" bigint,
	"lost_reason" text,
	"lost_note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sales"."quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"quotation_id" uuid NOT NULL,
	"item_id" uuid,
	"sku" varchar(64),
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "quotation_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0 AND "line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales"."quotation_status_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"quotation_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"changed_at" bigint NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_sort_idx" ON "sales"."quotation_items" ("quotation_id","sort_order");--> statement-breakpoint
CREATE INDEX "quotation_status_history_quotation_id_idx" ON "sales"."quotation_status_history" ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_code_uq" ON "sales"."quotations" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "quotations_base_code_idx" ON "sales"."quotations" ("base_code");--> statement-breakpoint
CREATE INDEX "quotations_customer_id_idx" ON "sales"."quotations" ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "sales"."quotations" ("status");--> statement-breakpoint
CREATE INDEX "quotations_created_by_idx" ON "sales"."quotations" ("created_by");--> statement-breakpoint
ALTER TABLE "sales"."quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotation_id_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales"."quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_previous_revision_id_quotations_id_fkey" FOREIGN KEY ("previous_revision_id") REFERENCES "sales"."quotations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'rejected', 'sent', 'superseded', 'won', 'lost'));--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_lost_reason_check" CHECK ("lost_reason" IS NULL OR "lost_reason" IN ('price', 'competitor', 'project_cancelled', 'no_response', 'other'));--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_revision_check" CHECK ("revision" >= 0);--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_vat_rate_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000);--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD CONSTRAINT "quotations_amounts_check" CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "grand_total" >= 0);