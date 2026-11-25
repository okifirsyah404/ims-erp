import { z } from 'zod';
import { TASK_STATUSES } from '@drizzle/schemas/human-resource.schema';
import { periodSchema } from './hr-records.contract';

/**
 * Request schemas of the employee portal's `/me` routes.
 *
 * @remarks
 * These routes never accept an `employeeId`: the employee is resolved from the
 * session by the guard, so a body can only describe the caller's own record.
 * Business dates are Jakarta `YYYY-MM-DD`; times are server-stamped.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

const page = {
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(200).default(20),
};

export const myProfileUpdateSchema = z.object({
	nickname: optionalText(100),
	phone: optionalText(100),
	address: z
		.object({
			addressLine: z.string().trim().min(1).max(500),
			villageId: z.uuid().nullish().transform((value) => value ?? null),
			postalCode: z.string().trim().max(10).nullish().transform((value) => value ?? null),
		})
		.nullish()
		.transform((value) => value ?? null),
});

export const myAttendanceMonthQuerySchema = z.object({ period: periodSchema });

export const myAttendanceListQuerySchema = z.object({
	...page,
	period: periodSchema.optional(),
});

export const myScheduleQuerySchema = z.object({ start: z.iso.date() });

export const myLeaveBodySchema = z.object({
	leaveTypeId: z.uuid(),
	startDate: z.iso.date(),
	endDate: z.iso.date(),
	reason: optionalText(1000),
});

export const myLeaveListQuerySchema = z.object({
	...page,
	period: periodSchema.optional(),
});

export const myOvertimeBodySchema = z.object({
	workDate: z.iso.date(),
	hours: z.number().positive().max(24).multipleOf(0.25),
	reason: optionalText(1000),
});

export const myOvertimeListQuerySchema = z.object({
	...page,
	period: periodSchema.optional(),
});

export const myTaskListQuerySchema = z.object({
	...page,
	status: z.enum(TASK_STATUSES).optional(),
});

export const myTaskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) });

export type TMyProfileUpdate = z.output<typeof myProfileUpdateSchema>;
export type TMyLeaveBody = z.output<typeof myLeaveBodySchema>;
export type TMyOvertimeBody = z.output<typeof myOvertimeBodySchema>;
export type TMyAttendanceListQuery = z.output<typeof myAttendanceListQuerySchema>;
export type TMyLeaveListQuery = z.output<typeof myLeaveListQuerySchema>;
export type TMyOvertimeListQuery = z.output<typeof myOvertimeListQuerySchema>;
export type TMyTaskListQuery = z.output<typeof myTaskListQuerySchema>;
