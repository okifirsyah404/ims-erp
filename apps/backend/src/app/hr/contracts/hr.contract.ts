import { z } from 'zod';
import { ATTENDANCE_STATUSES, EMPLOYMENT_STATUSES, REQUEST_STATUSES, TASK_STATUSES } from '@drizzle/schemas/hr.schema';

/**
 * Request schemas of the HR module (M08 stage 1). Business dates are
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

// Employees ---------------------------------------------------------------

export const employeeBodySchema = z.object({
	fullName: z.string().trim().min(1).max(200),
	nationalId: optionalText(32).refine((value) => value === null || /^\d{16}$/.test(value), 'NIK is 16 digits'),
	position: optionalText(200),
	email: optionalText(200).refine((value) => value === null || z.email().safeParse(value).success, 'Invalid email'),
	phone: optionalText(32),
	hireDate: z.iso.date().nullish().transform((value) => value ?? null),
	baseSalary: money.default(0),
	userId: optionalText(64),
	notes: optionalText(2000),
});

export const bankAccountSchema = z.object({
	bankName: z.string().trim().min(1).max(100),
	accountNumber: z.string().trim().min(3).max(50).regex(/^[0-9 -]+$/, 'Digits only'),
	accountHolder: z.string().trim().min(1).max(200),
});

export const employeeListQuerySchema = z.object({
	...page,
	search: z.string().trim().max(100).optional(),
	status: z.enum(EMPLOYMENT_STATUSES).optional(),
});

export const deactivateSchema = z.object({ inactiveSince: z.iso.date() });

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

export const idParamSchema = z.object({ id: z.uuid() });

export type TEmployeeBody = z.output<typeof employeeBodySchema>;
export type TBankAccountBody = z.output<typeof bankAccountSchema>;
export type TEmployeeListQuery = z.output<typeof employeeListQuerySchema>;
export type TAttendanceEntry = z.output<typeof attendanceEntrySchema>;
export type TLeaveBody = z.output<typeof leaveBodySchema>;
export type TOvertimeBody = z.output<typeof overtimeBodySchema>;
export type TRequestListQuery = z.output<typeof requestListQuerySchema>;
export type TTaskBody = z.output<typeof taskBodySchema>;
export type TTaskListQuery = z.output<typeof taskListQuerySchema>;
export type TSalaryBody = z.output<typeof salaryBodySchema>;
