import { and, inArray, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { leaveTypes } from '../../../drizzle/schemas/hr.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Leave types every environment needs (M08, decision 2026-11-07: 12 days a year). */
const LEAVE_TYPES = [
	{ code: 'ANNUAL', name: 'Cuti tahunan', attendanceStatus: 'leave', usesQuota: true, annualQuotaDays: 12 },
	{ code: 'SPECIAL', name: 'Cuti khusus (menikah, melahirkan, duka)', attendanceStatus: 'leave', usesQuota: false, annualQuotaDays: 0 },
	{ code: 'SICK', name: 'Sakit', attendanceStatus: 'sick', usesQuota: false, annualQuotaDays: 0 },
	{ code: 'PERMIT', name: 'Izin', attendanceStatus: 'permit', usesQuota: false, annualQuotaDays: 0 },
] as const;

/**
 * Leave types (M08 stage 1), in every environment.
 *
 * @remarks
 * A type is inserted only when its code is missing, so a type the company
 * edited is never overwritten. Idempotent: run it twice and nothing changes.
 * Employees themselves come from {@link seedHrEmployees} (ERP-0034).
 */
export async function seedLeaveTypes(): Promise<void> {
	const now = new Date();
	const existing = await drizzleDB
		.select({ code: leaveTypes.code })
		.from(leaveTypes)
		.where(and(isNull(leaveTypes.deletedAt), inArray(leaveTypes.code, LEAVE_TYPES.map((type) => type.code))));
	const have = new Set(existing.map((row) => row.code));
	const missing = LEAVE_TYPES.filter((type) => !have.has(type.code));
	if (missing.length > 0) {
		await drizzleDB.insert(leaveTypes).values(missing.map((type) => ({ ...type, createdAt: now, updatedAt: now })));
	}
	logger.info({ inserted: missing.length }, 'Leave types seeded');
}
