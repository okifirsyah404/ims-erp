import { z } from 'zod';

/**
 * Request schemas of the employee work schedule (ERP-0118). Business dates are
 * Jakarta `YYYY-MM-DD` strings; shift times `HH:MM` in Asia/Jakarta. A day off
 * carries no times; a working day carries both (an end earlier than the start
 * is an overnight shift).
 */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');

/** The most days one fill may cover (about two months). */
export const MAX_FILL_DAYS = 62;

const shiftFields = {
	isDayOff: z.boolean().default(false),
	shiftStart: time.nullish().transform((value) => value ?? null),
	shiftEnd: time.nullish().transform((value) => value ?? null),
	shiftLabel: z
		.string()
		.trim()
		.max(100)
		.nullish()
		.transform((value) => (value ? value : null)),
};

type TShiftShape = { isDayOff: boolean; shiftStart: string | null; shiftEnd: string | null };

/** A day off has no times; a working day needs both. */
const shiftIsConsistent = (value: TShiftShape) =>
	value.isDayOff ? value.shiftStart === null && value.shiftEnd === null : value.shiftStart !== null && value.shiftEnd !== null;
const shiftMessage = { message: 'A working day needs a start and an end; a day off has neither', path: ['shiftStart'] };

/** One shift, as the per-day pattern of a fill. */
export const shiftSchema = z.object(shiftFields).refine(shiftIsConsistent, shiftMessage);

/** One cell of the grid: an employee on a date. */
export const scheduleBodySchema = z
	.object({ employeeId: z.uuid(), workDate: z.iso.date(), ...shiftFields })
	.refine(shiftIsConsistent, shiftMessage);

export const scheduleWeekQuerySchema = z.object({ start: z.iso.date() });

/**
 * Fills a date range from a weekly pattern (Monday first). Cells that already
 * have a schedule are skipped, never overwritten. Without `employeeIds` every
 * visible active employee is filled.
 */
export const scheduleFillSchema = z
	.object({
		from: z.iso.date(),
		to: z.iso.date(),
		employeeIds: z.array(z.uuid()).min(1).max(500).optional(),
		pattern: z.array(shiftSchema).length(7),
	})
	.refine((value) => value.to >= value.from, { message: 'The end date is before the start date', path: ['to'] });

export type TScheduleBody = z.output<typeof scheduleBodySchema>;
export type TScheduleFill = z.output<typeof scheduleFillSchema>;
export type TShift = z.output<typeof shiftSchema>;
