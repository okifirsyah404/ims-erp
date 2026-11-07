import { fakerID_ID as faker } from '@faker-js/faker';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { employees, leaveTypes } from '../../../drizzle/schemas/hr.schema';
import { documentSequences } from '../../../drizzle/schemas/organization.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Leave types every environment needs (M08, decision 2026-11-07). */
const LEAVE_TYPES = [
	{ code: 'ANNUAL', name: 'Cuti tahunan', attendanceStatus: 'leave', usesQuota: true, annualQuotaDays: 12 },
	{ code: 'SPECIAL', name: 'Cuti khusus (menikah, melahirkan, duka)', attendanceStatus: 'leave', usesQuota: false, annualQuotaDays: 0 },
	{ code: 'SICK', name: 'Sakit', attendanceStatus: 'sick', usesQuota: false, annualQuotaDays: 0 },
	{ code: 'PERMIT', name: 'Izin', attendanceStatus: 'permit', usesQuota: false, annualQuotaDays: 0 },
] as const;

/** Dev employees: identity anchors are the fixed codes; the rest is faker. */
const DEV_EMPLOYEES = ['Teknisi', 'Teknisi', 'Admin Gudang', 'Staf Penjualan', 'Staf Keuangan', 'Project Manager'];

/**
 * HR master data (M08 stage 1).
 *
 * @remarks
 * Leave types are inserted in every environment when their code is missing
 * (an edited type is never overwritten). Development also gets sample
 * employees `EMP-0001…`, generated deterministically (`faker.seed`), and the
 * employee number series is moved past them so new employees never reuse a
 * code. Idempotent: run it twice and nothing changes.
 */
export async function seedHr(): Promise<void> {
	const now = new Date();
	const existingTypes = await drizzleDB
		.select({ code: leaveTypes.code })
		.from(leaveTypes)
		.where(and(isNull(leaveTypes.deletedAt), inArray(leaveTypes.code, LEAVE_TYPES.map((type) => type.code))));
	const haveTypes = new Set(existingTypes.map((row) => row.code));
	const newTypes = LEAVE_TYPES.filter((type) => !haveTypes.has(type.code));
	if (newTypes.length > 0) {
		await drizzleDB.insert(leaveTypes).values(newTypes.map((type) => ({ ...type, createdAt: now, updatedAt: now })));
	}
	logger.info({ inserted: newTypes.length }, 'Leave types seeded');

	if (isProductionEnv()) return;

	faker.seed(80_08);
	const codes = DEV_EMPLOYEES.map((_, index) => `EMP-${String(index + 1).padStart(4, '0')}`);
	const existing = new Set(
		(
			await drizzleDB
				.select({ code: employees.employeeCode })
				.from(employees)
				.where(and(isNull(employees.deletedAt), inArray(employees.employeeCode, codes)))
		).map((row) => row.code),
	);
	const rows = DEV_EMPLOYEES.map((position, index) => {
		// Generated for every row so the sequence stays the same on reruns.
		const fullName = faker.person.fullName();
		const nationalId = faker.string.numeric(16);
		const phone = faker.phone.number({ style: 'national' });
		const baseSalary = faker.number.int({ min: 45, max: 120 }) * 100_000_00;
		return {
			employeeCode: codes[index]!,
			fullName,
			nationalId,
			position,
			phone: phone.slice(0, 32),
			email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@entragate.local`,
			hireDate: `202${index % 5}-0${(index % 9) + 1}-01`,
			baseSalary,
			employmentStatus: 'active' as const,
			createdAt: now,
			updatedAt: now,
		};
	}).filter((row) => !existing.has(row.employeeCode));
	if (rows.length > 0) await drizzleDB.insert(employees).values(rows);

	// The employee series continues after the seeded codes.
	const next = codes.length + 1;
	await drizzleDB
		.insert(documentSequences)
		.values({ module: 'hr', documentType: 'employee', periodKey: 'all', nextNumber: next, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: documentSequences.documentType,
			targetWhere: isNull(documentSequences.deletedAt),
			set: { nextNumber: sql`greatest(${documentSequences.nextNumber}, ${next})`, updatedAt: now },
			setWhere: eq(documentSequences.documentType, 'employee'),
		});
	logger.info({ inserted: rows.length }, 'Dev employees seeded');
}
