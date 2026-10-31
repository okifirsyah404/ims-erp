import { auth } from '../../../src/providers/better-auth/auth';
import { drizzleDB } from '../../../drizzle/db';
import {
	members,
	organizations,
	users,
} from '../../../drizzle/schemas/auth.schema';
import { and, eq } from 'drizzle-orm';
import pino from 'pino';
import type { ErpRoleName } from '@ims-erp/common';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Internal back-office roles seeded as one account each. `owner` is the
 * initial admin (seeded by organization.seeder.ts); `investor` and `customer`
 * are portal identities that arrive with their portal modules (they must
 * link to CRM/investor rows, not back-office accounts). Role semantics come
 * from the shared catalog (`erpRoleNames` / `erpRoleGrants`) — no duplicate
 * definitions here.
 */
const SEED_INTERNAL_ROLES: readonly ErpRoleName[] = [
	'admin',
	'member',
	'operations_manager',
	'sales_manager',
	'sales',
	'project_manager',
	'technician',
	'freelancer',
	'purchasing',
	'warehouse',
	'finance',
	'accountant',
	'hr',
	'customer_service',
	'marketing',
	'auditor',
];

/** Deterministic, collision-free identity for a role's seed account. */
function seedIdentity(role: ErpRoleName): {
	email: string;
	username: string;
	name: string;
} {
	const titleCased = role
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
	return {
		email: `${role}.seed@entragate.local`,
		username: `${role}_seed`,
		name: `${titleCased} (Seed)`,
	};
}

/** Dev-only deterministic password: `<role>123456` (e.g. admin123456). */
function seedRolePassword(role: ErpRoleName): string {
	return `${role}123456`;
}

/**
 * Idempotent role-account seeder: one login-capable account per internal
 * role, added to the Entragate organization with that role.
 *
 * - Accounts are created via the Better Auth API (hashing/username
 *   normalization match real sign-up); membership via `auth.api.addMember`.
 * - Existence check is the membership row itself: an existing account
 *   without membership is joined; both present means skip.
 * - Passwords are deterministic dev-only values (`<role>123456`, e.g.
 *   `admin123456`); never logged. Re-runs never reset passwords.
 */
export async function seedOrganizationMembers(): Promise<void> {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, 'entragate'))
		.limit(1);

	if (!organization) {
		throw new Error(
			'Organization "entragate" not found — run the organization seeder first',
		);
	}

	let created = 0;
	for (const role of SEED_INTERNAL_ROLES) {
		const identity = seedIdentity(role);

		const [existingUser] = await drizzleDB
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, identity.email))
			.limit(1);

		const userId =
			existingUser?.id ??
			(
				await auth.api.createUser({
					body: {
						email: identity.email,
						name: identity.name,
						password: seedRolePassword(role),
						data: {
							username: identity.username,
							displayUsername: identity.username,
						} as Record<string, unknown>,
					},
				})
			).user.id;

		const [existingMember] = await drizzleDB
			.select({ id: members.id })
			.from(members)
			.where(
				and(
					eq(members.organizationId, organization.id),
					eq(members.userId, userId),
				),
			)
			.limit(1);

		if (existingMember) {
			logger.info(
				{ role, userId },
				'Role account already a member; skipping',
			);
			continue;
		}

		// Custom ERP roles are registered server-side via `erpRoles`; the
		// inferred endpoint type only knows built-in literals, hence the cast.
		await auth.api.addMember({
			body: {
				organizationId: organization.id,
				userId,
				role: role as 'member',
			},
		});
		created += 1;
		logger.info({ role, userId }, 'Role account added to organization');
	}

	logger.info(
		{ created, roles: SEED_INTERNAL_ROLES.length },
		'Role account seeding complete',
	);
}
