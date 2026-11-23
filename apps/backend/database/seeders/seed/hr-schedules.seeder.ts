import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { employees, schedules, type TScheduleInsert } from '../../../drizzle/schemas/human-resource.schema';
import { isProductionEnv } from '../../../config/providers/env';
import { addDays, weekdayIndex } from '../../../src/app/human-resource/utils/hr';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** The default pattern of the schedule fill (grill-me Q9): Mon-Sat 08:00-17:00, Sunday off. */
const WORKDAY = { shiftStart: '08:00', shiftEnd: '17:00', shiftLabel: 'Pagi', isDayOff: false };
const DAY_OFF = { shiftStart: null, shiftEnd: null, shiftLabel: null, isDayOff: true };

/** Today's business date in Asia/Jakarta. */
function todayJakarta(): string {
	return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Seeds `human_resource.schedules` (ERP-0118): the current and the next week
 * of every active seeded employee with the default pattern, so the
 * `/hr/schedule` grid has data in development.
 *
 * Re-runs are no-ops: any live schedule row means the table is already
 * seeded, and the insert also skips taken (employee, date) cells through the
 * partial unique index. Dates are relative to the run day, which is the point
 * of a "this week" demo grid; nothing is faker-generated.
 */
export async function seedHrSchedules(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping HR schedules');
		return;
	}
	const [existing] = await drizzleDB.select({ id: schedules.id }).from(schedules).where(isNull(schedules.deletedAt)).limit(1);
	if (existing) {
		logger.info('human_resource.schedules already seeded; skipping');
		return;
	}
	const people = await drizzleDB
		.select({ id: employees.id })
		.from(employees)
		.where(and(isNull(employees.deletedAt), eq(employees.employmentStatus, 'active')));
	if (people.length === 0) {
		logger.info('No active employees; skipping HR schedules');
		return;
	}

	const today = todayJakarta();
	const monday = addDays(today, -weekdayIndex(today));
	const now = new Date();
	const rows: TScheduleInsert[] = [];
	for (const person of people) {
		for (let offset = 0; offset < 14; offset += 1) {
			const workDate = addDays(monday, offset);
			rows.push({
				employeeId: person.id,
				workDate,
				...(weekdayIndex(workDate) === 6 ? DAY_OFF : WORKDAY),
				createdBy: null,
				createdAt: now,
				updatedAt: now,
			});
		}
	}
	const written = await drizzleDB
		.insert(schedules)
		.values(rows)
		.onConflictDoNothing({ target: [schedules.employeeId, schedules.workDate], where: isNull(schedules.deletedAt) })
		.returning({ id: schedules.id });
	logger.info({ created: written.length }, 'Seeded human_resource.schedules');
}
