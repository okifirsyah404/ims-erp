import { z } from 'zod';
import { SITE_ATTENDANCE_STATUSES } from '@drizzle/schemas/project.schema';

/**
 * Request schemas of the employee portal's project routes.
 *
 * @remarks
 * No route accepts an `employeeId` or a `userId`: the guard resolves those from
 * the session. Coordinates are validated here (the PostGIS expressions cannot
 * throw on out-of-range input), and the selfie is mandatory on check-in.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);
const accuracy = z.coerce.number().min(0).max(100_000).nullish().transform((value) => value ?? null);

const page = {
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const siteAttendanceListQuerySchema = z.object({
	...page,
	projectId: z.uuid().optional(),
	period: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM')
		.optional(),
	status: z.enum(SITE_ATTENDANCE_STATUSES).optional(),
});

export const siteCheckInSchema = z.object({
	projectId: z.uuid(),
	latitude,
	longitude,
	accuracyMeters: accuracy,
	note: optionalText(500),
	/** Mandatory proof of presence; the GPS claim is worthless without it. */
	selfie: z.instanceof(File),
});

export const siteCheckOutSchema = z.object({
	latitude,
	longitude,
	accuracyMeters: accuracy,
	note: optionalText(500),
});

export const siteAttendanceIdParamSchema = z.object({ id: z.uuid() });

export type TSiteAttendanceListQuery = z.output<typeof siteAttendanceListQuerySchema>;
export type TSiteCheckInBody = z.output<typeof siteCheckInSchema>;
export type TSiteCheckOutBody = z.output<typeof siteCheckOutSchema>;
