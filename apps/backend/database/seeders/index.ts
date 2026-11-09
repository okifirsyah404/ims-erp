import 'reflect-metadata';
import { DateTime, Duration } from 'luxon';
import pino from 'pino';
import { closeDB, drizzleDB } from '../../drizzle/db';
import { seedLocations } from './seed/location.seeder';
import { seedAuth } from './seed/auth.seeder';
import { seedInventory } from './seed/inventory.seeder';
import { seedAssets } from './seed/assets.seeder';
import { seedTax } from './seed/tax.seeder';
import { seedOrganization } from './seed/organization.seeder';
import { seedOrganizationMembers } from './seed/organization-members.seeder';
import { seedOrganizationRoles } from './seed/organization-roles.seeder';
import { seedCompanyProfile } from './seed/company-profile.seeder';
import { seedItemCategories } from './seed/item-category.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Runs all seeders. Exported so other scripts (e.g. migrate-reset) can reuse
 * it without spawning a child process; the caller owns closeDB/exit handling.
 */
export async function runSeeders(): Promise<void> {
	const startedAt = DateTime.now();
	logger.info({ startedAt: startedAt.toISO() }, 'Seeding started');

	await seedAuth();
	await seedLocations(drizzleDB);
	await seedOrganization();
	await seedOrganizationMembers();
	await seedOrganizationRoles();
	await seedCompanyProfile();
	await seedItemCategories();
	// Needs the organization (scope), location (address village), the item
	// category rows above; asset placements then reference the warehouse and
	// storage rows it creates.
	await seedInventory();
	await seedAssets();
	await seedTax();

	const finishedAt = DateTime.now();
	const elapsed = Duration.fromObject({
		milliseconds: finishedAt.diff(startedAt).milliseconds,
	})
		.shiftTo('hours', 'minutes', 'seconds', 'milliseconds')
		.toHuman();

	logger.info(
		{
			finishedAt: finishedAt.toISO(),
			duration: elapsed,
		},
		'Seeding complete',
	);
}

async function main(): Promise<void> {
	try {
		await runSeeders();
	} catch (error) {
		logger.error({ err: error }, 'Location seeding failed');
		process.exit(1);
	} finally {
		await closeDB();
	}
}

// Only run the CLI when invoked directly; importers (migrate-reset.ts) call
// runSeeders() themselves.
if (import.meta.main) {
	main().catch((error) => {
		console.error('Seeding failed:', error);
		process.exit(1);
	});
}
