import { DRIZZLE_TOKEN } from '@di/provider';
import { pointSql } from '@drizzle/datatypes/geo';
import { addresses, projectSettings, siteAttendances, type TSiteAttendanceSelect } from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { TSiteAttendanceListQuery } from '../contracts/site-attendance.contract';
import type {
	ISiteAttendanceRepository,
	TSiteAttendanceData,
	TSitePoint,
} from '../contracts/site-attendance.repository.interface';

/** Default radius when the setting is absent (grill decision: 100 m). */
export const DEFAULT_SITE_RADIUS_METERS = 100;

/** `project.settings` group/key holding the radius. */
export const RADIUS_SETTING_GROUP = 'attendance';
export const RADIUS_SETTING_KEY = 'site_radius_meters';

/**
 * Drizzle implementation of {@link ISiteAttendanceRepository}.
 *
 * @remarks
 * The two spatial queries are the only PostGIS use in the codebase, and they
 * stay here: `distanceMeters` / `withinMeters` render `ST_Distance` /
 * `ST_DWithin` over a `geography` cast of the stored `numeric` columns, so the
 * 100 m rule is evaluated by the database rather than by the client or by a
 * hand-rolled haversine.
 */
@injectable()
export class SiteAttendanceRepository implements ISiteAttendanceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findSitePoint(projectId: string): Promise<TSitePoint | null> {
		const [row] = await this.database
			.select({
				latitude: addresses.latitude,
				longitude: addresses.longitude,
				label: addresses.label,
				sitePoint: addresses.sitePoint,
			})
			.from(addresses)
			.where(
				and(
					eq(addresses.projectId, projectId),
					eq(addresses.isPrimary, true),
					isNull(addresses.deletedAt),
					isNotNull(addresses.sitePoint),
				),
			)
			.limit(1);
		if (!row) return null;
		// The geometry column is the spatial source; the numeric mirror is what
		// the UI shows, so fall back to the point when a row predates it.
		const point = row.sitePoint;
		const latitude = row.latitude !== null ? Number(row.latitude) : (point?.y ?? null);
		const longitude = row.longitude !== null ? Number(row.longitude) : (point?.x ?? null);
		if (latitude === null || longitude === null) return null;
		return { latitude, longitude, label: row.label };
	}

	async radiusMeters(): Promise<number> {
		const [row] = await this.database
			.select({ value: projectSettings.settingValue })
			.from(projectSettings)
			.where(
				and(
					eq(projectSettings.settingGroup, RADIUS_SETTING_GROUP),
					eq(projectSettings.settingKey, RADIUS_SETTING_KEY),
					isNull(projectSettings.deletedAt),
				),
			)
			.limit(1);
		const parsed = Number(row?.value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SITE_RADIUS_METERS;
	}

	async measure(
		projectId: string,
		point: { latitude: number; longitude: number },
		meters: number,
	): Promise<{ distanceMeters: number; within: boolean } | null> {
		// The Drizzle PostGIS guide's shape: a `sql` point expression, then
		// ST_Distance / ST_DWithin over the indexed geometry column. Casting to
		// `geography` is what makes the answer metres instead of degrees.
		const sqlPoint = pointSql(point);
		const [row] = await this.database
			.select({
				distance: sql<number>`ST_Distance(${addresses.sitePoint}::geography, (${sqlPoint})::geography)`.mapWith(
					Number,
				),
				within: sql<boolean>`ST_DWithin(${addresses.sitePoint}::geography, (${sqlPoint})::geography, ${meters})`.mapWith(
					Boolean,
				),
			})
			.from(addresses)
			.where(
				and(
					eq(addresses.projectId, projectId),
					eq(addresses.isPrimary, true),
					isNull(addresses.deletedAt),
					isNotNull(addresses.sitePoint),
				),
			)
			.limit(1);
		if (!row) return null;
		return { distanceMeters: Number(row.distance), within: Boolean(row.within) };
	}

	async findById(id: string): Promise<TSiteAttendanceSelect | null> {
		const [row] = await this.database
			.select()
			.from(siteAttendances)
			.where(and(eq(siteAttendances.id, id), isNull(siteAttendances.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findDay(projectId: string, employeeId: string, date: string): Promise<TSiteAttendanceSelect | null> {
		const [row] = await this.database
			.select()
			.from(siteAttendances)
			.where(
				and(
					eq(siteAttendances.projectId, projectId),
					eq(siteAttendances.employeeId, employeeId),
					eq(siteAttendances.businessDate, date),
					isNull(siteAttendances.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(data: TSiteAttendanceData): Promise<TSiteAttendanceSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(siteAttendances)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row!;
	}

	async checkOut(
		id: string,
		data: { at: Date; latitude: number; longitude: number; accuracyMeters: number | null; note: string | null },
	): Promise<TSiteAttendanceSelect | null> {
		const [row] = await this.database
			.update(siteAttendances)
			.set({
				checkOutAt: data.at,
				checkOutLatitude: String(data.latitude),
				checkOutLongitude: String(data.longitude),
				accuracyMeters: data.accuracyMeters === null ? undefined : String(data.accuracyMeters),
				note: data.note ?? undefined,
				updatedAt: new Date(),
			})
			.where(and(eq(siteAttendances.id, id), isNull(siteAttendances.checkOutAt), isNull(siteAttendances.deletedAt)))
			.returning();
		return row ?? null;
	}

	private where(query: TSiteAttendanceListQuery) {
		const period = query.period;
		const range = period
			? {
					start: `${period}-01`,
					end: `${period}-${String(new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`,
				}
			: null;
		return and(
			isNull(siteAttendances.deletedAt),
			query.projectId ? eq(siteAttendances.projectId, query.projectId) : undefined,
			query.status ? eq(siteAttendances.status, query.status) : undefined,
			range ? gte(siteAttendances.businessDate, range.start) : undefined,
			range ? lte(siteAttendances.businessDate, range.end) : undefined,
		);
	}

	private async paginate(where: ReturnType<SiteAttendanceRepository['where']>, query: TSiteAttendanceListQuery) {
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(siteAttendances)
			.where(where);
		const data = await this.database
			.select()
			.from(siteAttendances)
			.where(where)
			.orderBy(desc(siteAttendances.businessDate), desc(siteAttendances.checkInAt))
			.limit(query.limit)
			.offset((query.page - 1) * query.limit);
		return paginationResult({ page: query.page, limit: query.limit }, Number(total ?? 0), data) satisfies TPaginationResult<TSiteAttendanceSelect>;
	}

	paginateForEmployee(employeeId: string, query: TSiteAttendanceListQuery): Promise<TPaginationResult<TSiteAttendanceSelect>> {
		return this.paginate(and(this.where(query), eq(siteAttendances.employeeId, employeeId)), query);
	}

	paginateForProject(projectId: string, query: TSiteAttendanceListQuery): Promise<TPaginationResult<TSiteAttendanceSelect>> {
		return this.paginate(and(this.where(query), eq(siteAttendances.projectId, projectId)), query);
	}
}

