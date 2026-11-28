ALTER TABLE "procurement"."purchase_orders" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_orders" ADD COLUMN "closed_at" bigint;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_orders" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "procurement"."purchase_orders" DROP CONSTRAINT "purchase_orders_status_check", ADD CONSTRAINT "purchase_orders_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'sent', 'partially_received', 'received', 'cancelled', 'closed'));