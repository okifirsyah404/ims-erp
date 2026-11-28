import { fakerID_ID as faker } from '@faker-js/faker';
import { type ErpRoleName, withBaseMemberRole } from '@ims-erp/common';
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
import { isProductionEnv } from '../../../config/providers/env';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Per-role member seeding configuration. `userCount` is how many accounts
 * to seed with that role in the target organization (`0` skips the role).
 *
 * Edit this array directly to control seed volume — e.g. bump `hr` to 24 to
 * generate users-table pagination volume. Instances beyond the first of a
 * role get suffixed anchors (`hr.seed.01@entragate.local` / `hr_seed_01`).
 *
 * Not listed here: `owner` (the initial admin, seeded by
 * organization.seeder.ts). `investor` and `customer` are application roles
 * (ADR-0018), not organization roles, so they are never seeded as members;
 * portal identities arrive with their portal modules. Role semantics come
 * from the shared catalog (`erpRoleNames` / `erpRoleGrants`) — no duplicate
 * definitions.
 */
export type TMemberSeedEntry = {
	role: ErpRoleName;
	userCount: number;
};
export type TMemberSeedConfig = readonly TMemberSeedEntry[];

/**
 * The member seeding plan; edited in-place to change volumes. One account per
 * offered role (P7-4): the removed roles (`admin`, `sales_manager`,
 * `accountant`, `auditor`) and the base `member` role get no account.
 */
export const MEMBER_SEED_CONFIG: TMemberSeedConfig = [
	{ role: 'operations_manager', userCount: 1 },
	{ role: 'sales', userCount: 1 },
	{ role: 'project_manager', userCount: 1 },
	{ role: 'technician', userCount: 1 },
	{ role: 'freelancer', userCount: 1 },
	{ role: 'purchasing', userCount: 1 },
	{ role: 'warehouse', userCount: 1 },
	{ role: 'finance', userCount: 1 },
	{ role: 'hr', userCount: 24 },
	{ role: 'customer_service', userCount: 1 },
	{ role: 'marketing', userCount: 1 },
];

/**
 * One test account per person with that person's role mix (K2, P7-4,
 * `rancangan-data-seeder.md` section 3). Used by the P7-4 UAT: two sales
 * people approve each other's quotations, Bella is the merged finance role,
 * Dafrin and Oki are freelancers. The full per-person seeder rework is L-16.
 */
export type TPersonSeedEntry = {
	/** Anchor slug: `<slug>.seed@example.com` / `<slug>_seed`. */
	slug: string;
	name: string;
	roles: readonly ErpRoleName[];
};

export const PERSON_SEED_CONFIG: readonly TPersonSeedEntry[] = [
	{ slug: 'aqim', name: 'Aqim (uji)', roles: ['owner', 'hr'] },
	{ slug: 'bella', name: 'Bella (uji)', roles: ['finance'] },
	{ slug: 'agus_md', name: 'Agus MD (uji)', roles: ['sales'] },
	{
		slug: 'bilal',
		name: 'Bilal (uji)',
		roles: ['sales', 'warehouse', 'customer_service', 'marketing'],
	},
	{
		slug: 'agus',
		name: 'Agus (uji)',
		roles: ['project_manager', 'technician', 'warehouse'],
	},
	{ slug: 'dafrin', name: 'Dafrin (uji)', roles: ['freelancer'] },
	{ slug: 'oki', name: 'Oki (uji)', roles: ['freelancer'] },
];

/**
 * Deterministic, collision-free identity for a role's seed account.
 *
 * @remarks
 * Email and username are the seeder's idempotency anchors — deliberately NOT
 * faker-generated (see the `faker` skill). Fake content (`name`, `bio`,
 * `phone`) is generated separately by {@link seedAccountContent}.
 *
 * The first account of a role keeps the bare anchors
 * (`hr.seed@entragate.local` / `hr_seed`) so existing seeded databases stay
 * idempotent. Additional accounts (config `userCount > 1`) get a 1-based
 * zero-padded suffix: `hr.seed.01@entragate.local` / `hr_seed_01`, …
 */
function seedIdentity(
	role: ErpRoleName,
	instance: number,
): {
	email: string;
	username: string;
} {
	const bare = {
		email: `${role}.seed@entragate.local`,
		username: `${role}_seed`,
	};
	if (instance === 0) return bare;
	const suffix = String(instance).padStart(2, '0');
	return {
		email: `${role}.seed.${suffix}@entragate.local`,
		username: `${role}_seed_${suffix}`,
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
 * The phone is derived deterministically from the account's email anchor
 * (not the loop position, which changes when {@link MEMBER_SEED_CONFIG}
 * volumes change) using a distinct `+62 899` prefix. That namespace cannot
 * collide with any historical `+62 811` row, and the email hash is unique
 * per account — so the unique `users_phone_live_idx` index can never be
 * violated regardless of config edits or re-seeding order.
 */
function seedAccountContent(email: string): {
	name: string;
	bio: string;
	phone: string;
} {
	let hash = 0;
	for (const character of email) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}
	return {
		// Text goes through seedSafeText: faker emits occasional emoji/
		// multi-byte characters a WIN1252-encoded dev database cannot store
		// (see faker-content.ts).
		name: seedSafeText(faker.person.fullName()),
		bio: seedSafeText(faker.person.bio()),
		phone: `+62899${String(hash % 1_000_000_000).padStart(9, '0')}`,
	};
}

/**
 * Idempotent role-account seeder: login-capable accounts per internal role,
 * added to the Entragate organization with that role. Account volume comes
 * from the {@link MEMBER_SEED_CONFIG} array in this file.
 *
 * - Accounts are created via the Better Auth API (hashing/username
 *   normalization match real sign-up); membership via `auth.api.addMember`.
 * - Identity fields are fixed anchors (`<role>.seed@entragate.local`,
 *   `<role>_seed`, `<role>123456`; suffixed `.01`, `.02`… beyond the first
 *   account of a role); faker fills content (`name`, `bio`, `phone`)
 *   deterministically under `FAKER_SEED`. `phone` is written directly via
 *   Drizzle (`input: false` additionalField owned by the user-management
 *   module).
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
	// Dev-only: the accounts have guessable passwords (`<role>123456`). Since
	// ADR-0012 the organization also exists in production, so the guard can no
	// longer rely on a missing organization.
	if (isProductionEnv()) {
		logger.info('Production environment; skipping role accounts');
		return;
	}
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
	const requested = MEMBER_SEED_CONFIG.reduce(
		(sum, entry) => sum + entry.userCount,
		0,
	);

	logger.info(
		{ created, requested, roles: MEMBER_SEED_CONFIG.length },
		'Role account seeding complete',
	);
}

/**
 * Adds seed accounts to an organization per the given configuration.
 *
 * @param organizationId - Target organization
 * @returns number of memberships created
 *
 * @remarks
 * Extracted from the seeder so seeded accounts can also be joined to
 * additional organizations (ADR-0007). Accounts are global-unique users, so
 * the same account may hold a membership in several organizations; the
 * existence check is the `(organizationId, userId)` membership row.
 * `userCount: 0` entries are skipped entirely.
 */
export async function addSeedMembersTo(
	organizationId: string,
): Promise<number> {
	// Fixed faker seed: content fields (name, bio, phone) are deterministic,
	// so re-runs and fresh databases produce identical accounts (see the
	// `faker` skill). Identity anchors (email, username, password) are
	// faker-independent.
	faker.seed(FAKER_SEED);

	// Fixed faker seed: content fields (name, bio) are deterministic, so
	// re-runs and fresh databases produce identical accounts (see the
	// `faker` skill). Identity anchors (email, username, password) and the
	// email-derived phone are faker-independent.
	faker.seed(FAKER_SEED);

	let created = 0;
	for (const { role, userCount } of MEMBER_SEED_CONFIG) {
		for (let instance = 0; instance < userCount; instance++) {
			const identity = seedIdentity(role, instance);
			const content = seedAccountContent(identity.email);
			created += await upsertSeedMember(
				organizationId,
				`${role}#${instance}`,
				[role],
				identity,
				content,
				seedRolePassword(role),
			);
		}
	}
	// Per-person accounts after the per-role ones, so adding them leaves the
	// faker sequence of the role accounts unchanged.
	for (const person of PERSON_SEED_CONFIG) {
		const identity = {
			email: `${person.slug}.seed@example.com`,
			username: `${person.slug}_seed`,
		};
		const content = { ...seedAccountContent(identity.email), name: person.name };
		created += await upsertSeedMember(
			organizationId,
			person.slug,
			person.roles,
			identity,
			content,
			`${person.slug}123456`,
		);
	}
	return created;
}

/**
 * Creates (or reuses) one seed account and joins it to the organization.
 * Returns 1 when a membership was created, 0 when it already existed.
 *
 * @remarks
 * The membership carries the base `member` role plus the given roles
 * (P7-4), the same shape the backend writes for every member.
 */
async function upsertSeedMember(
	organizationId: string,
	label: string,
	roles: readonly ErpRoleName[],
	identity: { email: string; username: string },
	content: { name: string; bio: string; phone: string },
	password: string,
): Promise<number> {
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
					password,
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

	if (existingUser) {
		logger.info(
			{ account: label, userId, organizationId },
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

	if (existingMember) {
		logger.info(
			{ account: label, userId, organizationId },
			'Role account already a member; skipping',
		);
		return 0;
	}

	const role = withBaseMemberRole(roles).join(',');
	if (roles.includes('owner')) {
		// Better Auth's escalation hook refuses an `owner` grant without an
		// acting owner session, so a seeded co-owner is written directly (the
		// organization seeder does the same for the first owner).
		await drizzleDB.insert(members).values({
			id: crypto.randomUUID(),
			organizationId,
			userId,
			role,
			createdAt: new Date(),
		});
	} else {
		// Custom ERP roles are registered server-side via `erpRoles`; the
		// inferred endpoint type only knows built-in literals, hence the cast.
		await auth.api.addMember({
			body: {
				organizationId,
				userId,
				role: role as 'member',
			},
		});
	}
	logger.info(
		{ account: label, userId, organizationId },
		'Role account added to organization',
	);
	return 1;
}
