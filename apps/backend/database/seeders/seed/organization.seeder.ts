import { auth } from '../../../src/providers/better-auth/auth';
import { appConfig } from '../../../config/providers/config';
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
 * Idempotent organization seeder: creates the single deployment organization
 * ("Entragate") with the initial global admin as its `owner` member.
 *
 * - Single-organization invariant: skipped entirely when any organization
 *   row exists (soft-deleted included).
 * - The admin account is created by `seedAuth` first; if it is missing this
 *   seeder fails — the owner must be a real, login-capable account.
 * - Creation goes through the Better Auth API (server-side) so the creator
 *   is registered as the owner member in the same call.
 */
export async function seedOrganization(): Promise<void> {
	const [existing] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.limit(1);

	if (existing) {
		logger.info(
			{ organizationId: existing.id },
			'An organization already exists; skipping organization seeding',
		);
		return;
	}

	const { seedAdminEmail } = appConfig.auth;
	const [admin] = await drizzleDB
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, seedAdminEmail))
		.limit(1);

	if (!admin) {
		throw new Error(
			`Seed admin (${seedAdminEmail}) not found — run the auth seeder first`,
		);
	}

	const organization = await auth.api.createOrganization({
		body: {
			name: SEED_ORGANIZATION_NAME,
			slug: SEED_ORGANIZATION_SLUG,
			// Server-side: registers the admin as the organization owner.
			userId: admin.id,
		},
	});

	logger.info(
		{ organizationId: organization.id, ownerId: admin.id },
		'Organization "Entragate" created with the initial admin as owner',
	);
}
