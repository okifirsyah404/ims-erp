CREATE TABLE "document"."signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"signer_user_id" text NOT NULL,
	"signer_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"decline_reason" text,
	"expires_at" bigint,
	"responded_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "signature_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "document"."documents"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
	CONSTRAINT "signature_requests_status_check" CHECK ("status" IN ('pending', 'signed', 'declined', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX "signature_requests_document_id_idx" ON "document"."signature_requests" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_requests_signer_status_idx" ON "document"."signature_requests" USING btree ("signer_user_id","status");--> statement-breakpoint
CREATE INDEX "signature_requests_requested_by_idx" ON "document"."signature_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_requests_pending_uq" ON "document"."signature_requests" USING btree ("document_id","signer_user_id") WHERE "status" = 'pending' AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE "document"."user_signatures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" text,
	"user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"uploaded_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);--> statement-breakpoint
CREATE UNIQUE INDEX "user_signatures_user_id_uq" ON "document"."user_signatures" USING btree ("user_id") WHERE "deleted_at" IS NULL;
