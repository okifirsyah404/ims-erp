CREATE SCHEMA "location";
--> statement-breakpoint
CREATE TABLE "location"."districts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	"regency_id" uuid
);
--> statement-breakpoint
CREATE TABLE "location"."provinces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "location"."regencies" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	"province_id" uuid
);
--> statement-breakpoint
CREATE TABLE "location"."villages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"code" varchar(20) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint,
	"deleted_at" bigint,
	"district_id" uuid
);
--> statement-breakpoint
CREATE INDEX "district_name_idx" ON "location"."districts" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "district_code_idx" ON "location"."districts" ("code");--> statement-breakpoint
CREATE INDEX "province_name_idx" ON "location"."provinces" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "province_code_idx" ON "location"."provinces" ("code");--> statement-breakpoint
CREATE INDEX "regency_name_idx" ON "location"."regencies" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "regency_code_idx" ON "location"."regencies" ("code");--> statement-breakpoint
CREATE INDEX "village_name_idx" ON "location"."villages" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "village_code_idx" ON "location"."villages" ("code");--> statement-breakpoint
ALTER TABLE "location"."districts" ADD CONSTRAINT "districts_regency_id_regencies_id_fkey" FOREIGN KEY ("regency_id") REFERENCES "location"."regencies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location"."regencies" ADD CONSTRAINT "regencies_province_id_provinces_id_fkey" FOREIGN KEY ("province_id") REFERENCES "location"."provinces"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location"."villages" ADD CONSTRAINT "villages_district_id_districts_id_fkey" FOREIGN KEY ("district_id") REFERENCES "location"."districts"("id") ON DELETE CASCADE;
