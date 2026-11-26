CREATE TABLE "finance"."fixed_asset_books" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" text,
	"item_id" uuid,
	"fiscal_group" text,
	"capitalized_on" date NOT NULL,
	"capitalized_amount" bigint NOT NULL,
	"counterpart_account_id" uuid NOT NULL,
	"capitalization_entry_id" uuid,
	"disposal_entry_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "fixed_asset_books_status_check" CHECK (status IN ('active', 'disposed')),
	CONSTRAINT "fixed_asset_books_amount_check" CHECK (capitalized_amount > 0),
	CONSTRAINT "fixed_asset_books_fiscal_group_check" CHECK (fiscal_group IS NULL OR fiscal_group IN ('kelompok_1', 'kelompok_2', 'kelompok_3', 'kelompok_4', 'bangunan_permanen', 'bangunan_tidak_permanen'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_asset_books_item_uq" ON "finance"."fixed_asset_books" ("organization_id","item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "fixed_asset_books_status_idx" ON "finance"."fixed_asset_books" ("status");--> statement-breakpoint
ALTER TABLE "finance"."fixed_asset_books" ADD CONSTRAINT "fixed_asset_books_DvesqSVwkKxa_fkey" FOREIGN KEY ("counterpart_account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "finance"."fixed_asset_books" ADD CONSTRAINT "fixed_asset_books_ZnUHbxFhZMUd_fkey" FOREIGN KEY ("capitalization_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "finance"."fixed_asset_books" ADD CONSTRAINT "fixed_asset_books_disposal_entry_id_journal_entries_id_fkey" FOREIGN KEY ("disposal_entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL;