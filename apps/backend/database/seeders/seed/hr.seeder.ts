import { eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	employees,
	type TEmployeeInsert,
} from '../../../drizzle/schemas/human-resource.schema';
import { members, organizations, users } from '../../../drizzle/schemas/auth.schema';
import { HumanResourceNumberingService } from '../../../src/app/human-resource/services/human-resource-numbering.service';
import { HumanResourceCodeNumberingRepository } from '../../../src/app/human-resource/repositories/code-numbering.repository';
import { isProductionEnv } from '../../../config/providers/env';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Which seeded roles get an employee record, and how many per role. */
const HR_SEED_ROLES = [
	'admin',
	'operations_manager',
	'hr',
	'warehouse',
	'finance',
	'sales',
] as const;

/** Company-level (organization_id NULL) employees get deterministic anchors. */
const COMPANY_LEVEL = [
	{ email: 'ceo.company@entragate.local', fullName: 'Sari Wulandari' },
	{ email: 'cfo.company@entragate.local', fullName: 'Andi Pratama' },
];

/**
 * Seeds `hr.employees`: one employee per selected seeded member (linked by
 * `user_id`, invite-first by construction since the members already have
 * logins) plus a couple of company-level staff (ERP-0034 slice 8).
 *
 * Re-runs are no-ops: the `hr_employees_user_uq` partial unique index makes
 * an existing link skip, and company-level emails are checked by email.
 *
 * @remarks
 * Employee codes come from the shared numbering service (EMP series), the
 * same path the API uses.
 */
export async function seedHrEmployees(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping HR employees');
		return;
	}

	const [existingCount] = await drizzleDB
		.select({ id: employees.id })
		.from(employees)
		.where(isNull(employees.deletedAt))
		.limit(1);
	if (existingCount) {
		logger.info('hr.employees already seeded; skipping');
		return;
	}

	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, 'entragate'))
		.limit(1);
	if (!organization) {
		logger.info('Organization "entragate" not found; skipping HR employees');
		return;
	}

	// The seeder runs outside the DI container, so the numbering service is
	// wired by hand over its own repository and the company letterhead facade.
	// The seeder runs outside the DI container. The {COMPANY} token is the
	// seeded profile's document code (see company.seeder.ts), so the facade is
	// a literal here instead of a repository chain.
	const numbering = new HumanResourceNumberingService(
		new HumanResourceCodeNumberingRepository(drizzleDB),
		{ requireDocumentCode: async () => 'DEV' } as never,
	);

	let created = 0;

	for (const role of HR_SEED_ROLES) {
		const roleUsers = await drizzleDB
			.select({ id: users.id, name: users.name, email: users.email })
			.from(members)
			.innerJoin(users, eq(users.id, members.userId))
			.where(eq(members.organizationId, organization.id))
			.limit(50);
		// Filter by role seed anchor on the email (…/role.seed…/…).
		const matched = roleUsers.filter((u) => u.email.startsWith(`${role}.`));
		for (const user of matched) {
			const employeeCode = await numbering.next('employee');
			const row: TEmployeeInsert = {
				employeeCode,
				organizationId: organization.id,
				userId: user.id,
				fullName: user.name,
				email: user.email,
				employmentStatus: 'active',
				employmentType: 'permanent',
				workType: 'onsite',
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			await drizzleDB.insert(employees).values(row);
			created += 1;
		}
	}

	for (const person of COMPANY_LEVEL) {
		const [user] = await drizzleDB
			.select({ id: users.id, name: users.name, email: users.email })
			.from(users)
			.where(eq(users.email, person.email))
			.limit(1);
		if (!user) continue; // account not seeded — skip quietly
		const employeeCode = await numbering.next('employee');
		await drizzleDB.insert(employees).values({
			employeeCode,
			organizationId: null,
			userId: user.id,
			fullName: user.name,
			email: user.email,
			employmentStatus: 'active',
			employmentType: 'permanent',
			workType: 'hybrid',
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		created += 1;
	}

	logger.info({ created }, 'HR employee seeding complete');
}
