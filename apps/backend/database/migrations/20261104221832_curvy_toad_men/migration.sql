CREATE SCHEMA "organization";
--> statement-breakpoint
CREATE TABLE "organization"."document_sequences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" varchar(64) NOT NULL,
	"doc_type" varchar(32) NOT NULL,
	"prefix" varchar(16) DEFAULT '' NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint
);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_sequences_org_type_uq" ON "organization"."document_sequences" ("organization_id","doc_type");--> statement-breakpoint
CREATE INDEX "document_sequences_org_idx" ON "organization"."document_sequences" ("organization_id");