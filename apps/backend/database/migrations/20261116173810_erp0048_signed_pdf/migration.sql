ALTER TABLE "document"."signatures" ADD COLUMN "signature_image_key" text;--> statement-breakpoint
ALTER TABLE "document"."signatures" ADD COLUMN "source_file_id" uuid;--> statement-breakpoint
ALTER TABLE "document"."signatures" ADD COLUMN "signed_file_key" text;--> statement-breakpoint
CREATE INDEX "signatures_source_file_id_idx" ON "document"."signatures" ("source_file_id");--> statement-breakpoint
ALTER TABLE "document"."access_logs" DROP CONSTRAINT "access_logs_action_check", ADD CONSTRAINT "access_logs_action_check" CHECK ("action" IN ('view', 'download', 'print', 'share', 'delete', 'pdf_sign'));