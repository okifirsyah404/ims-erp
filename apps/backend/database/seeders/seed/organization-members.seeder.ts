import { fakerID_ID as faker } from '@faker-js/faker';
import type { ErpRoleName } from '@ims-erp/common';
import { and, eq } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	members,
	organizations,
	users,
} from '../../../drizzle/schemas/auth.schema';
import { auth } from '../../../src/providers/better-auth/auth';
import { seedSafeText } from './faker-content';

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

/**
 * Deterministic, collision-free identity for a role's seed account.
 *
 * @remarks
 * Email and username are the seeder's idempotency anchors — deliberately NOT
 * faker-generated (see the `faker` skill). Fake content (`name`, `bio`,
 * `phone`) is generated separately by {@link seedAccountContent}.
 */
function seedIdentity(role: ErpRoleName): {
	email: string;
	username: string;
} {
	return {
		email: `${role}.seed@entragate.local`,
		username: `${role}_seed`,
	};
}

/** Dev-only deterministic password: `<role>123456` (e.g. admin123456). */
function seedRolePassword(role: ErpRoleName): string {
	return `${role}123456`;
}

/**
 * Deterministic faker seed for role-account content generation.
 *
 * @remarks
 * Identity fields (email, username, password) are fixed anchors and carry
 * seeder idempotency; faker only fills content (`name`, `bio`, `phone`).
 * Seeding faker makes those stable across runs, so the existence guards stay
 * no-ops on re-runs. Change only together with a fresh database (see the
 * `faker` skill).
 */
const FAKER_SEED = 20261103;

/**
 * Generates the fake contact content for one role account.
 *
 * @remarks
 * Phone uses a fixed `+62 811` prefix + zero-padded role index so the 16
 * accounts can never collide on the unique `users_phone_live_idx` index,
 * while faker supplies the trailing digits deterministically.
 */
function seedAccountContent(index: number): {
	name: string;
	bio: string;
	phone: string;
} {
	return {
		// Text goes through seedSafeText: faker emits occasional emoji/
		// multi-byte characters a WIN1252-encoded dev database cannot store
		// (see faker-content.ts).
		name: seedSafeText(faker.person.fullName()),
		bio: seedSafeText(faker.person.bio()),
		phone: `+62811${String(index).padStart(2, '0')}${faker.string.numeric(6)}`,
	};
}

/**
 * Idempotent role-account seeder: one login-capable account per internal
 * role, added to the Entragate organization with that role.
 *
 * - Accounts are created via the Better Auth API (hashing/username
 *   normalization match real sign-up); membership via `auth.api.addMember`.
 * - Identity fields are fixed anchors (`<role>.seed@entragate.local`,
 *   `<role>_seed`, `<role>123456`); faker fills content (`name`, `bio`,
 *   `phone`) deterministically under `FAKER_SEED`. `phone` is written
 *   directly via Drizzle (`input: false` additionalField owned by the
 *   user-management module).
 * - Existence check is the membership row itself: an existing account
 *   without membership is joined; both present means skip. Existing
 *   accounts are reused as-is (password/name/phone never reset).
 * - Passwords are deterministic dev-only values (`<role>123456`, e.g.
 *   `admin123456`); never logged. Re-runs never reset passwords.
 * - Missing organization is a no-op, not an error: in production the
 *   organization seeder is skipped by design (ADR-0007) and seeding must not
 *   abort the remaining seeders.
 */
export async function seedOrganizationMembers(): Promise<void> {
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, 'entragate'))
		.limit(1);

	if (!organization) {
		logger.info(
			'Organization "entragate" not found (organization seeding skipped); skipping role accounts',
		);
		return;
	}

	const created = await addSeedMembersTo(organization.id);

	logger.info(
		{ created, roles: SEED_INTERNAL_ROLES.length },
		'Role account seeding complete',
	);
}

/**
 * Adds one login-capable seed account per internal role to an organization.
 *
 * @param organizationId - Target organization
 * @returns number of memberships created
 *
 * @remarks
 * Extracted from the seeder so seeded accounts can also be joined to
 * additional organizations (ADR-0007). Accounts are global-unique users, so
 * the same account may hold a membership in several organizations; the
 * existence check is the `(organizationId, userId)` membership row.
 */
export async function addSeedMembersTo(
	organizationId: string,
): Promise<number> {
	// Fixed faker seed: content fields (name, bio, phone) are deterministic,
	// so re-runs and fresh databases produce identical accounts (see the
	// `faker` skill). Identity anchors (email, username, password) are
	// faker-independent.
	faker.seed(FAKER_SEED);

	let created = 0;
	for (const [index, role] of SEED_INTERNAL_ROLES.entries()) {
		const identity = seedIdentity(role);
		const content = seedAccountContent(index);

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
						name: content.name,
						password: seedRolePassword(role),
						data: {
							username: identity.username,
							displayUsername: identity.username,
							// `bio` is an input-allowed additionalField; `phone` is
							// `input: false` and is written directly below (the
							// user-management module owns that column via Drizzle).
							bio: content.bio,
						} as Record<string, unknown>,
					},
				})
			).user.id;

		const [existingMember] = await drizzleDB
			.select({ id: members.id })
			.from(members)
			.where(
				and(
					eq(members.organizationId, organizationId),
					eq(members.userId, userId),
				),
			)
			.limit(1);

		if (existingUser) {
			logger.info(
				{ role, userId, organizationId },
				'Role account already exists; reusing (password/phone NOT reset)',
			);
		} else {
			// `phone` is an `input: false` additionalField: Better Auth's API
			// surface does not accept it, so the seeder writes the column
			// directly — the same ownership rule the user-management module
			// applies (set via Drizzle, never via the auth API).
			await drizzleDB
				.update(users)
				.set({ phone: content.phone })
				.where(eq(users.id, userId));
		}

		if (existingMember) {
			logger.info(
				{ role, userId, organizationId },
				'Role account already a member; skipping',
			);
			continue;
		}

		// Custom ERP roles are registered server-side via `erpRoles`; the
		// inferred endpoint type only knows built-in literals, hence the cast.
		await auth.api.addMember({
			body: {
				organizationId,
				userId,
				role: role as 'member',
			},
		});
		created += 1;
		logger.info(
			{ role, userId, organizationId },
			'Role account added to organization',
		);
	}

	return created;
}
