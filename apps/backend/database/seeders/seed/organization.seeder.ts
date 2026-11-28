import { auth } from '../../../src/providers/better-auth/auth';
import { appConfig } from '../../../config/providers/config';
import { drizzleDB } from '../../../drizzle/db';
import { members, organizations, users } from '../../../drizzle/schemas/auth.schema';
import { withBaseMemberRole } from '@ims-erp/common';
import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

export const SEED_ORGANIZATION_NAME = 'Entragate';
export const SEED_ORGANIZATION_SLUG = 'entragate';

/**
 * Creates an organization (idempotently) with the given user as its `owner`.
 *
 * @param input.name - Organization display name
 * @param input.slug - Unique kebab-case slug
 * @param input.ownerEmail - User to register as owner; must already exist
 * @returns the organization id, or `null` when it already existed
 *
 * @remarks
 * Creation goes through the Better Auth API as a system action (explicit
 * `userId`), so the application-admin creator gate does not apply — the owner
 * must still be a real, login-capable account.
 */
export async function ensureOrganization(input: {
	name: string;
	slug: string;
	ownerEmail: string;
}): Promise<string | null> {
	const [existing] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, input.slug))
		.limit(1);

	if (existing) {
		logger.info(
			{ organizationId: existing.id, slug: input.slug },
			'Organization already exists; skipping',
		);
		return null;
	}

	const [owner] = await drizzleDB
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, input.ownerEmail))
		.limit(1);

	if (!owner) {
		throw new Error(
			`Seed owner (${input.ownerEmail}) not found — run the auth seeder first`,
		);
	}

	const organization = await auth.api.createOrganization({
		body: {
			name: input.name,
			slug: input.slug,
			// Server-side: registers the owner as the organization owner.
			userId: owner.id,
		},
	});

	// Better Auth writes the creator as a bare `owner`; every member also
	// carries the base `member` role (P7-4), like the backend writes it.
	await drizzleDB
		.update(members)
		.set({ role: withBaseMemberRole(['owner']).join(',') })
		.where(
			and(
				eq(members.organizationId, organization.id),
				eq(members.userId, owner.id),
			),
		);

	logger.info(
		{ organizationId: organization.id, ownerId: owner.id },
		`Organization "${input.name}" created`,
	);
	return organization.id;
}

/**
 * Idempotent seeder for the default organization ("Entragate"), with the
 * initial admin as its `owner` member.
 *
 * @remarks
 * Runs in **every environment** (production included). It does nothing when
 * any live organization already exists, whatever its slug — it only seeds the
 * first organization; additional ones are created through the admin UI
 * (ADR-0012: multiple organizations are allowed, ADR-0007 §1).
 */
export async function seedOrganization(): Promise<void> {
	const [live] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(isNull(organizations.deletedAt))
		.limit(1);
	if (live) {
		logger.info({ organizationId: live.id }, 'Organization already exists; skipping');
		return;
	}

	await ensureOrganization({
		name: SEED_ORGANIZATION_NAME,
		slug: SEED_ORGANIZATION_SLUG,
		ownerEmail: appConfig.auth.seedAdminEmail,
	});
}
