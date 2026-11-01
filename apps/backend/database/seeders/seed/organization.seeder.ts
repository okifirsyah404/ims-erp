import { auth } from '../../../src/providers/better-auth/auth';
import { appConfig } from '../../../config/providers/config';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { organizations, users } from '../../../drizzle/schemas/auth.schema';
import { eq } from 'drizzle-orm';
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

	logger.info(
		{ organizationId: organization.id, ownerId: owner.id },
		`Organization "${input.name}" created`,
	);
	return organization.id;
}

/**
 * Idempotent organization seeder for the default deployment organization
 * ("Entragate"), with the initial admin as its `owner` member.
 *
 * @remarks
 * **Skipped entirely in production** (`prod`/`production`): production
 * organizations are created through the API by an application admin, and the
 * first organization is NOT assumed to be seeded. The skip is a no-op rather
 * than a throw so the remaining seeders still run.
 *
 * The seeded organization is keyed by slug, so additional organizations can
 * be seeded alongside it via {@link ensureOrganization}.
 */
export async function seedOrganization(): Promise<void> {
	if (isProductionEnv()) {
		logger.info(
			'Production environment; skipping organization seeding (create organizations through the API)',
		);
		return;
	}

	await ensureOrganization({
		name: SEED_ORGANIZATION_NAME,
		slug: SEED_ORGANIZATION_SLUG,
		ownerEmail: appConfig.auth.seedAdminEmail,
	});
}
