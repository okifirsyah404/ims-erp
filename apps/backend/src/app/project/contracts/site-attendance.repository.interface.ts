import type {
	TSiteAttendanceInsert,
	TSiteAttendanceSelect,
} from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { TSiteAttendanceListQuery } from './site-attendance.contract';

/** The project's site point, if the address has coordinates. */
export type TSitePoint = {
	latitude: number;
	longitude: number;
	label: string | null;
};

/** Insert shape: the repository stamps the timestamps. */
export type TSiteAttendanceData = Omit<
	TSiteAttendanceInsert,
	'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/**
 * Persistence port of `project.site_attendances` and the two lookups only it
 * needs (`project.addresses` coordinates and the radius setting).
 */
export interface ISiteAttendanceRepository {
	/** The primary site address of the project with coordinates, if any. */
	findSitePoint(projectId: string): Promise<TSitePoint | null>;

	/** `project.settings.site_radius_meters`, default 100. */
	radiusMeters(): Promise<number>;

	/**
	 * PostGIS measurement: the distance in metres from the site point to the
	 * given coordinates, and whether it lies inside `meters`.
	 *
	 * @remarks
	 * One query, two answers: the radius test (`ST_DWithin` on `geography`) and
	 * the distance that is snapshotted on the row (`ST_Distance`).
	 */
	measure(
		projectId: string,
		point: { latitude: number; longitude: number },
		meters: number,
	): Promise<{ distanceMeters: number; within: boolean } | null>;

	findById(id: string): Promise<TSiteAttendanceSelect | null>;
	/** The live row of one employee on one project on a date. */
	findDay(projectId: string, employeeId: string, date: string): Promise<TSiteAttendanceSelect | null>;
	create(data: TSiteAttendanceData): Promise<TSiteAttendanceSelect>;
	checkOut(
		id: string,
		data: { at: Date; latitude: number; longitude: number; accuracyMeters: number | null; note: string | null },
	): Promise<TSiteAttendanceSelect | null>;

	/** The caller's own rows, newest first. */
	paginateForEmployee(
		employeeId: string,
		query: TSiteAttendanceListQuery,
	): Promise<TPaginationResult<TSiteAttendanceSelect>>;

	/** Everyone's rows on one project, newest first (PIC / HR view). */
	paginateForProject(
		projectId: string,
		query: TSiteAttendanceListQuery,
	): Promise<TPaginationResult<TSiteAttendanceSelect>>;
}

