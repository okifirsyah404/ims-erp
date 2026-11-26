-- PostGIS is a database capability, not a table, so Drizzle never generates it.
-- Per the Drizzle PostGIS guide this is a custom migration. It must run before
-- the `project.addresses.site_point` column exists, which is why it comes first.
CREATE EXTENSION IF NOT EXISTS postgis;
