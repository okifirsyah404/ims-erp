-- ERP-0042 (3/3): the `document` schema.
-- Hand-written, append-only (same convention as 20261113090000).
--
-- Registry + issuance module. The tables existed only in docs/database
-- (schema `documents`, `documents.*` names) and were never migrated; this
-- creates them under the final names (schema `document`). organization_id is
-- nullable: NULL = company-wide (ADR-0011 pattern of inventory and assets).
-- Uniqueness on (organization_id, code) is split into a tenant partial index
-- and a company-wide partial index because PostgreSQL treats NULLs as
-- distinct.

CREATE SCHEMA IF NOT EXISTS "document";

CREATE TABLE IF NOT EXISTS "document"."templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"document_type" text NOT NULL,
	"module" text,
	"version" integer NOT NULL DEFAULT 1,
	"content_template" text,
	"numbering_pattern" text,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "templates_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "templates_org_code_version_uq"
	ON "document"."templates" ("organization_id", "code", "version")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "templates_global_code_version_uq"
	ON "document"."templates" ("code", "version")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NULL;

CREATE TABLE IF NOT EXISTS "document"."documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"code" varchar(32) NOT NULL,
	"document_type" text NOT NULL,
	"title" text NOT NULL,
	"template_id" uuid,
	"module" text,
	"source_type" text,
	"source_id" text,
	"status" text NOT NULL DEFAULT 'draft',
	"issued_on" date,
	"issued_by_user_id" text,
	"approved_by_user_id" text,
	"approved_at" bigint,
	"version" integer NOT NULL DEFAULT 1,
	"is_current" boolean NOT NULL DEFAULT true,
	"supersedes_document_id" uuid,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "documents_status_check"
		CHECK ("status" IN ('draft', 'submitted', 'approved', 'issued', 'void', 'expired', 'archived')),
	CONSTRAINT "documents_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "documents_org_code_uq"
	ON "document"."documents" ("organization_id", "code")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "documents_global_code_uq"
	ON "document"."documents" ("code")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NULL;
CREATE INDEX IF NOT EXISTS "documents_template_id_idx"
	ON "document"."documents" ("template_id");
CREATE INDEX IF NOT EXISTS "documents_source_idx"
	ON "document"."documents" ("module", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "documents_status_idx"
	ON "document"."documents" ("status");

CREATE TABLE IF NOT EXISTS "document"."files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint NOT NULL DEFAULT 0,
	"checksum" text,
	"uploaded_by_user_id" text,
	"uploaded_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "files_size_bytes_check" CHECK ("size_bytes" >= 0)
);

CREATE INDEX IF NOT EXISTS "files_document_id_idx"
	ON "document"."files" ("document_id");
CREATE UNIQUE INDEX IF NOT EXISTS "files_storage_key_uq"
	ON "document"."files" ("storage_key");

CREATE TABLE IF NOT EXISTS "document"."signatures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"signer_type" text NOT NULL,
	"signer_user_id" text,
	"signer_name" text NOT NULL,
	"signed_at" bigint NOT NULL,
	"signature_method" text NOT NULL DEFAULT 'electronic',
	"ip_address" text,
	"certificate_serial" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "signatures_signer_type_check"
		CHECK ("signer_type" IN ('internal', 'customer', 'partner')),
	CONSTRAINT "signatures_signature_method_check"
		CHECK ("signature_method" IN ('electronic', 'wet_ink', 'stamp'))
);

CREATE INDEX IF NOT EXISTS "signatures_document_id_idx"
	ON "document"."signatures" ("document_id");

CREATE TABLE IF NOT EXISTS "document"."access_logs" (
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
	CONSTRAINT "access_logs_action_check"
		CHECK ("action" IN ('view', 'download', 'print', 'share', 'delete'))
);

CREATE INDEX IF NOT EXISTS "access_logs_document_id_idx"
	ON "document"."access_logs" ("document_id");
CREATE INDEX IF NOT EXISTS "access_logs_accessed_at_idx"
	ON "document"."access_logs" ("accessed_at");

CREATE TABLE IF NOT EXISTS "document"."shares" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"share_type" text NOT NULL,
	"shared_with_type" text,
	"shared_with_id" text,
	"shared_by_user_id" text,
	"shared_at" bigint NOT NULL,
	"expires_at" bigint,
	"is_revoked" boolean NOT NULL DEFAULT false,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "shares_share_type_check"
		CHECK ("share_type" IN ('internal', 'customer', 'portal', 'public_link'))
);

CREATE INDEX IF NOT EXISTS "shares_document_id_idx"
	ON "document"."shares" ("document_id");
CREATE INDEX IF NOT EXISTS "shares_target_idx"
	ON "document"."shares" ("share_type", "shared_with_type", "shared_with_id");

CREATE TABLE IF NOT EXISTS "document"."tags" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"tag" text NOT NULL,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_org_tag_uq"
	ON "document"."tags" ("organization_id", "tag")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tags_global_tag_uq"
	ON "document"."tags" ("tag")
	WHERE "deleted_at" IS NULL AND "organization_id" IS NULL;

CREATE TABLE IF NOT EXISTS "document"."tag_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"document_id" uuid NOT NULL,
	"document_tag_id" uuid NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS "tag_links_uq"
	ON "document"."tag_links" ("document_id", "document_tag_id");
CREATE INDEX IF NOT EXISTS "tag_links_tag_id_idx"
	ON "document"."tag_links" ("document_tag_id");
