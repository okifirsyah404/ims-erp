import { isNull } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import { companyProfiles } from '../../../drizzle/schemas/organization.schema';
import { SEED_ORGANIZATION_NAME } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Dev-only company profile, so document numbers work right after seeding
 * (`{COMPANY}` comes from the profile's document code, ADR-0011).
 *
 * @remarks
 * Idempotent: does nothing when a live profile exists, so an edited
 * profile is never overwritten. Skipped in production, where the owner
 * fills in the real profile through the settings page.
 */
export async function seedCompanyProfile(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping company profile seeding');
		return;
	}
	const [existing] = await drizzleDB
		.select({ id: companyProfiles.id })
		.from(companyProfiles)
		.where(isNull(companyProfiles.deletedAt))
		.limit(1);
	if (existing) {
		logger.info('Company profile already exists; skipping');
		return;
	}
	const now = new Date();
	await drizzleDB.insert(companyProfiles).values({
		legalName: `PT ${SEED_ORGANIZATION_NAME} (dev)`,
		documentCode: 'DEV',
		createdAt: now,
		updatedAt: now,
	});
	logger.info('Seeded dev company profile');
}
