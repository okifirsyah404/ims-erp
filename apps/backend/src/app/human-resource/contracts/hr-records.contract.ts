import { z } from 'zod';
import { ATTENDANCE_STATUSES, REQUEST_STATUSES, TASK_STATUSES } from '@drizzle/schemas/human-resource.schema';

/**
 * Request schemas of the M08 employee records (attendance,
 * leave, overtime, tasks, salary summary) on top of ERP-0034 employees. Business dates are
 * Jakarta `YYYY-MM-DD` strings, times `HH:MM`, money IDR minor units.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const time = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM')
	.nullish()
	.transform((value) => value ?? null);
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM');

const page = {
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(200).default(20),
};

// Attendance ----------------------------------------------------------------

export const attendanceEntrySchema = z.object({
	employeeId: z.uuid(),
	status: z.enum(ATTENDANCE_STATUSES),
	checkIn: time,
	checkOut: time,
	notes: optionalText(500),
});

export const attendanceDaySchema = z.object({
	date: z.iso.date(),
	entries: z.array(attendanceEntrySchema).min(1).max(500),
});

export const attendanceDayQuerySchema = z.object({ date: z.iso.date() });

/** One attendance row entered on its own (the list view). */
export const attendanceRecordSchema = attendanceEntrySchema.extend({ date: z.iso.date() });

export const attendanceListQuerySchema = z.object({
	...page,
	employeeId: z.uuid().optional(),
	from: z.iso.date().optional(),
	to: z.iso.date().optional(),
	status: z.enum(ATTENDANCE_STATUSES).optional(),
});
export const attendanceMonthQuerySchema = z.object({ period: periodSchema });

// Leave and overtime -------------------------------------------------------

export const leaveBodySchema = z.object({
	employeeId: z.uuid(),
	leaveTypeId: z.uuid(),
	startDate: z.iso.date(),
	endDate: z.iso.date(),
	reason: optionalText(1000),
});

export const overtimeBodySchema = z.object({
	employeeId: z.uuid(),
	workDate: z.iso.date(),
	hours: z.number().positive().max(24).multipleOf(0.25),
	reason: optionalText(1000),
});

export const decisionSchema = z.object({ note: optionalText(1000) });

export const requestListQuerySchema = z.object({
	...page,
	employeeId: z.uuid().optional(),
	status: z.enum(REQUEST_STATUSES).optional(),
	period: periodSchema.optional(),
});

export const balanceQuerySchema = z.object({ employeeId: z.uuid(), year: z.coerce.number().int().min(2000).max(2100) });

// Tasks ---------------------------------------------------------------------

export const taskBodySchema = z.object({
	employeeId: z.uuid(),
	title: z.string().trim().min(1).max(200),
	description: optionalText(2000),
	dueDate: z.iso.date().nullish().transform((value) => value ?? null),
});

export const taskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) });

export const taskListQuerySchema = z.object({
	...page,
	employeeId: z.uuid().optional(),
	status: z.enum(TASK_STATUSES).optional(),
});

// Salary summaries -----------------------------------------------------------

export const salaryBodySchema = z.object({
	period: periodSchema,
	employeeId: z.uuid(),
	baseSalary: money,
	allowances: money.default(0),
	overtimePay: money.default(0),
	bonus: money.default(0),
	deductions: money.default(0),
	notes: optionalText(1000),
});

export const salaryPeriodQuerySchema = z.object({ period: periodSchema });

export const recordIdParamSchema = z.object({ id: z.uuid() });

export type TAttendanceEntry = z.output<typeof attendanceEntrySchema>;
export type TAttendanceRecordBody = z.output<typeof attendanceRecordSchema>;
export type TAttendanceListQuery = z.output<typeof attendanceListQuerySchema>;
export type TLeaveBody = z.output<typeof leaveBodySchema>;
export type TOvertimeBody = z.output<typeof overtimeBodySchema>;
export type TRequestListQuery = z.output<typeof requestListQuerySchema>;
export type TTaskBody = z.output<typeof taskBodySchema>;
export type TTaskListQuery = z.output<typeof taskListQuerySchema>;
export type TSalaryBody = z.output<typeof salaryBodySchema>;

/**
 * Which employees' records the caller sees: company-level employees and
 * those of the caller's active organization, or all of them for an
 * application admin — the same rule as ERP-0034's employee list.
 */
export type THrScope = { organizationId: string; all: boolean };

/** Server-derived caller context of the M08 record endpoints. */
export type THrContext = {
	actorUserId: string;
	scope: THrScope;
	/** `employee:read_private`: NIK and bank account unmasked. */
	canReadPrivate: boolean;
};
