/**
 * PostGIS helpers.
 *
 * @remarks
 * Follows the Drizzle PostGIS guide (`geometry` column type + `sql` operators)
 * rather than a hand-rolled custom type:
 *
 * - `project.addresses.site_point` is `geometry(point, 4326)` with a GiST index,
 *   written from `latitude`/`longitude` (migration backfill + seeder).
 * - Distances and the radius test cast to `geography` so the unit is metres;
 *   `ST_Distance` on raw geometry would answer in degrees.
 *
 * The extension itself is a database capability, not a table: Drizzle never
 * generates it, so `database/migrations/<custom>/migration.sql` creates it and
 * {@link ensurePostgisExtension} is the boot-time safety net.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';

/** A WGS84 point in plain numbers (`x` = longitude, `y` = latitude). */
export type TGeoPoint = { latitude: number; longitude: number };

/** `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` for a literal point. */
export function pointSql(point: TGeoPoint): SQL {
	return sql`ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)`;
}

/**
 * Creates the PostGIS extension when the database is missing it.
 *
 * @remarks
 * `CREATE EXTENSION` needs a superuser or a preinstalled package. When that
 * fails the app still boots, because only field attendance depends on PostGIS
 * and its error ("PostGIS is required") is far more useful than a boot crash.
 */
export async function ensurePostgisExtension(database: BunSQLDatabase): Promise<boolean> {
	try {
		await database.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`);
		return true;
	} catch {
		return false;
	}
}
