ALTER TABLE "project"."addresses" ADD COLUMN "site_point" geometry(point,4326);--> statement-breakpoint
CREATE INDEX "project_addresses_site_point_idx" ON "project"."addresses" USING gist ("site_point");--> statement-breakpoint
-- Backfill the geometry from the coordinates that already exist, so no row
-- needs re-entering. `longitude` is X, `latitude` is Y (PostGIS convention).
UPDATE "project"."addresses"
SET "site_point" = ST_SetSRID(ST_MakePoint("longitude"::float8, "latitude"::float8), 4326)
WHERE "site_point" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
