import { desc, eq } from 'drizzle-orm';
import { drizzleDB } from '../../../drizzle/db';
import { organizations, users } from '../../../drizzle/schemas/auth.schema';
import {
	employees,
	leaveRequests,
	leaveTypes,
	overtimeRequests,
} from '../../../drizzle/schemas/human-resource.schema';
import { projectSettings } from '../../../drizzle/schemas/project.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';
import { isProductionEnv } from '../../../config/providers/env';
import pino from 'pino';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Jakarta business date offset, matching the backend helpers. */
const JAKARTA_OFFSET_MS = 7 * 3_600_000;

function businessDate(offsetDays = 0): string {
	return new Date(Date.now() + JAKARTA_OFFSET_MS + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Resolves the seeded employee that should log into the portal.
 *
 * @remarks
 * The portal guard needs **both** an employee record and a membership, and the
 * demo project's PIC is the first linked employee by creation order — so this
 * seeder asks the database who that is instead of assuming a role. Prints the
 * login so a manual walk-through has no guessing.
 */
async function portalPerson() {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	if (!organization) return null;
	const [person] = await drizzleDB
		.select({
			employeeId: employees.id,
			fullName: employees.fullName,
			employeeCode: employees.employeeCode,
			userId: employees.userId,
			email: users.email,
			username: users.username,
		})
		.from(employees)
		.innerJoin(users, eq(users.id, employees.userId))
		.where(eq(employees.organizationId, organization.id))
		.limit(1);
	return person ?? null;
}

/**
 * Seeds what the portal's HR screens need in order to show something real:
 * one pending leave request, one approved overtime record, and the portal
 * account printed for a manual login.
 *
 * @remarks
 * Idempotent on `leave_requests.reason` / `overtime_requests.reason` markers of
 * the same employee, so a re-run adds nothing. No approval path is exercised:
 * the rows are written directly with the status the screen should show.
 */
export async function seedPortalDemo(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Portal demo seeding skipped in production');
		return;
	}

	const person = await portalPerson();
	if (!person?.userId) {
		logger.info('Portal demo seeding skipped: no linked employee yet');
		return;
	}

	const now = new Date();

	const [annual] = await drizzleDB
		.select({ id: leaveTypes.id })
		.from(leaveTypes)
		.where(eq(leaveTypes.code, 'ANNUAL'))
		.limit(1);
	const existingLeave = await drizzleDB
		.select({ id: leaveRequests.id })
		.from(leaveRequests)
		.where(eq(leaveRequests.reason, 'Demo: acara keluarga'))
		.limit(1);
	if (annual && existingLeave.length === 0) {
		await drizzleDB.insert(leaveRequests).values({
			employeeId: person.employeeId,
			leaveTypeId: annual.id,
			startDate: businessDate(3),
			endDate: businessDate(4),
			days: 2,
			reason: 'Demo: acara keluarga',
			status: 'submitted',
			recordedBy: person.userId,
			createdAt: now,
			updatedAt: now,
		});
	}

	const existingOvertime = await drizzleDB
		.select({ id: overtimeRequests.id })
		.from(overtimeRequests)
		.where(eq(overtimeRequests.reason, 'Demo: lembur instalasi'))
		.limit(1);
	if (existingOvertime.length === 0) {
		await drizzleDB.insert(overtimeRequests).values({
			employeeId: person.employeeId,
			workDate: businessDate(-1),
			hours: '2.00',
			reason: 'Demo: lembur instalasi',
			status: 'approved',
			recordedBy: person.userId,
			decidedBy: person.userId,
			decidedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	const [radius] = await drizzleDB
		.select({ value: projectSettings.settingValue })
		.from(projectSettings)
		.where(eq(projectSettings.settingKey, 'site_radius_meters'))
		.orderBy(desc(projectSettings.updatedAt))
		.limit(1);

	logger.info(
		{
			name: person.fullName,
			employeeCode: person.employeeCode,
			email: person.email,
			username: person.username,
			radiusMeters: radius?.value ?? null,
		},
		'Portal demo ready: sign in with this account',
	);
}

