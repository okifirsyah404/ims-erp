import { auth } from '../../../src/providers/better-auth/auth';
import { appConfig } from '../../../config/providers/config';
import { drizzleDB } from '../../../drizzle/db';
import { users } from '../../../drizzle/schemas/auth.schema';
import { GLOBAL_ADMIN_ROLE } from '../../../src/providers/better-auth/ac/admin-ac';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Idempotent auth seeder: creates the initial global admin user via the
 * Better Auth instance (so password hashing and username normalization match
 * real sign-up behavior).
 *
 * - Credentials come from appConfig.auth (env-overridable dev defaults,
 *   INITIAL_ADMIN_* variables). Values are never logged.
 * - Existence check goes through the database (the admin listUsers endpoint
 *   requires an authenticated session, which a seed run does not have).
 * - Existing users are left untouched: re-running never resets passwords.
 * - No organization membership is seeded: a global admin intentionally does
 *   NOT gain ERP access until explicitly added to an organization.
 */
export async function seedAuth(): Promise<void> {
	const { seedAdminEmail, seedAdminUsername, seedAdminPassword } =
		appConfig.auth;

	const [existing] = await drizzleDB
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, seedAdminEmail))
		.limit(1);

	if (existing) {
		logger.info(
			{ userId: existing.id },
			'Initial admin already exists; skipping (password NOT reset)',
		);
		return;
	}

	const created = await auth.api.createUser({
		body: {
			email: seedAdminEmail,
			name: seedAdminUsername,
			password: seedAdminPassword,
			role: GLOBAL_ADMIN_ROLE,
			data: {
				username: seedAdminUsername,
				displayUsername: seedAdminUsername,
			} as Record<string, unknown>,
		},
	});

	logger.info(
		{ userId: created.user.id },
		'Initial admin user created (global role: admin)',
	);
}
