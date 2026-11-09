CREATE SCHEMA "procurement";
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"purchase_order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"specification" text,
	"unit" varchar(32) NOT NULL,
	"quantity" numeric(18,3) DEFAULT '1' NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint DEFAULT 0 NOT NULL,
	"quantity_received" numeric(18,3) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_order_items_amounts_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "line_total" >= 0 AND "quantity_received" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(40),
	"supplier_id" uuid NOT NULL,
	"supplier_snapshot" jsonb NOT NULL,
	"category" text NOT NULL,
	"subject" varchar(200) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"supplier_quote_ref" varchar(100),
	"supplier_quote_date" date,
	"project_name" varchar(200),
	"buyer_pic_name" varchar(120),
	"vat_mode" text DEFAULT 'none' NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"currency_code" varchar(3) DEFAULT 'IDR' NOT NULL,
	"payment_terms" varchar(500),
	"terms" text,
	"notes" text,
	"rejection_reason" text,
	"created_by" text,
	"submitted_by" text,
	"submitted_at" bigint,
	"approved_by" text,
	"approved_at" bigint,
	"sent_by" text,
	"sent_at" bigint,
	"cancelled_by" text,
	"cancelled_at" bigint,
	"cancelled_reason" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "purchase_orders_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'sent', 'partially_received', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_category_check" CHECK ("category" IN ('hardware', 'software', 'service', 'other')),
	CONSTRAINT "purchase_orders_vat_mode_check" CHECK ("vat_mode" IN ('none', 'included', 'added')),
	CONSTRAINT "purchase_orders_vat_rate_check" CHECK ("vat_rate_bps" >= 0 AND "vat_rate_bps" <= 10000),
	CONSTRAINT "purchase_orders_amounts_check" CHECK ("subtotal" >= 0 AND "tax_total" >= 0 AND "grand_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"supplier_type" text DEFAULT 'company' NOT NULL,
	"tax_id" varchar(16),
	"email" text,
	"phone" varchar(30),
	"whatsapp" varchar(30),
	"website" varchar(200),
	"address_line" text,
	"village_id" uuid,
	"postal_code" varchar(10),
	"pic_name" varchar(120),
	"pic_title" varchar(100),
	"pic_phone" varchar(30),
	"pic_email" text,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"payment_term_note" varchar(300),
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_holder" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "suppliers_type_check" CHECK ("supplier_type" IN ('company', 'individual', 'government')),
	CONSTRAINT "suppliers_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "suppliers_payment_terms_check" CHECK ("payment_terms_days" >= 0)
);
--> statement-breakpoint
CREATE INDEX "purchase_order_items_order_sort_idx" ON "procurement"."purchase_order_items" ("purchase_order_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_code_uq" ON "procurement"."purchase_orders" ("code") WHERE deleted_at IS NULL AND code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_id_idx" ON "procurement"."purchase_orders" ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "procurement"."purchase_orders" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_code_uq" ON "procurement"."suppliers" ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "procurement"."suppliers" ("name");--> statement-breakpoint
CREATE INDEX "suppliers_status_idx" ON "procurement"."suppliers" ("status");--> statement-breakpoint
CREATE INDEX "suppliers_tax_id_idx" ON "procurement"."suppliers" ("tax_id");--> statement-breakpoint
ALTER TABLE "procurement"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "procurement"."purchase_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "procurement"."suppliers"("id") ON DELETE RESTRICT;