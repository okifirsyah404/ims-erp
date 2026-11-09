ALTER TABLE "inventory"."items" ADD COLUMN "image_object_key" text;--> statement-breakpoint
ALTER TABLE "organization"."company_profiles" ADD COLUMN "signature_object_key" text;--> statement-breakpoint
ALTER TABLE "sales"."quotation_items" ADD COLUMN "image_object_key" text;--> statement-breakpoint
ALTER TABLE "sales"."quotations" ADD COLUMN "heading" varchar(120);