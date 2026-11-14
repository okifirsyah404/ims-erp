CREATE SCHEMA "document";
--> statement-breakpoint
CREATE TABLE "document"."access_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"accessed_by_user_id" text,
	"action" text NOT NULL,
	"accessed_at" bigint NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "access_logs_action_check" CHECK ("action" IN ('view', 'download', 'print', 'share', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "document"."files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"checksum" text,
	"uploaded_by_user_id" text,
	"uploaded_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "files_size_bytes_check" CHECK ("size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document"."shares" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"share_type" text NOT NULL,
	"token" uuid,
	"shared_with_type" text,
	"shared_with_id" text,
	"shared_by_user_id" text,
	"shared_at" bigint NOT NULL,
	"expires_at" bigint,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "shares_share_type_check" CHECK ("share_type" IN ('internal', 'customer', 'portal', 'public_link'))
);
--> statement-breakpoint
CREATE TABLE "document"."signatures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"signer_type" text NOT NULL,
	"signer_user_id" text,
	"signer_name" text NOT NULL,
	"signed_at" bigint NOT NULL,
	"signature_method" text DEFAULT 'electronic' NOT NULL,
	"ip_address" text,
	"certificate_serial" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "signatures_signer_type_check" CHECK ("signer_type" IN ('internal', 'customer', 'partner')),
	CONSTRAINT "signatures_signature_method_check" CHECK ("signature_method" IN ('electronic', 'wet_ink', 'stamp'))
);
--> statement-breakpoint
CREATE TABLE "document"."tag_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"document_tag_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "document"."tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tag" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "document"."templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"module" text,
	"version" integer DEFAULT 1 NOT NULL,
	"content_template" text,
	"numbering_pattern" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "templates_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "document"."documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"document_type" text NOT NULL,
	"title" text NOT NULL,
	"template_id" uuid,
	"module" text,
	"source_type" text,
	"source_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"issued_on" date,
	"issued_by_user_id" text,
	"approved_by_user_id" text,
	"approved_at" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"supersedes_document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "documents_status_check" CHECK ("status" IN ('draft', 'submitted', 'approved', 'issued', 'void', 'expired', 'archived')),
	CONSTRAINT "documents_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE INDEX "access_logs_document_id_idx" ON "document"."access_logs" ("document_id");--> statement-breakpoint
CREATE INDEX "access_logs_accessed_at_idx" ON "document"."access_logs" ("accessed_at");--> statement-breakpoint
CREATE INDEX "files_document_id_idx" ON "document"."files" ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_uq" ON "document"."files" ("storage_key");--> statement-breakpoint
CREATE INDEX "shares_document_id_idx" ON "document"."shares" ("document_id");--> statement-breakpoint
CREATE INDEX "shares_target_idx" ON "document"."shares" ("share_type","shared_with_type","shared_with_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_token_uq" ON "document"."shares" ("token") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "shares_token_live_idx" ON "document"."shares" ("token","expires_at") WHERE deleted_at IS NULL AND is_revoked = false;--> statement-breakpoint
CREATE INDEX "signatures_document_id_idx" ON "document"."signatures" ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_links_uq" ON "document"."tag_links" ("document_id","document_tag_id");--> statement-breakpoint
CREATE INDEX "tag_links_tag_id_idx" ON "document"."tag_links" ("document_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_org_tag_uq" ON "document"."tags" ("organization_id","tag") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_global_tag_uq" ON "document"."tags" ("tag") WHERE deleted_at IS NULL AND organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_org_code_version_uq" ON "document"."templates" ("organization_id","code","version") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "templates_global_code_version_uq" ON "document"."templates" ("code","version") WHERE deleted_at IS NULL AND organization_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_org_code_uq" ON "document"."documents" ("organization_id","code") WHERE deleted_at IS NULL AND organization_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_global_code_uq" ON "document"."documents" ("code") WHERE deleted_at IS NULL AND organization_id IS NULL;--> statement-breakpoint
CREATE INDEX "documents_template_id_idx" ON "document"."documents" ("template_id");--> statement-breakpoint
CREATE INDEX "documents_source_idx" ON "document"."documents" ("module","source_type","source_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "document"."documents" ("status");
