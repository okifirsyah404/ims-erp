import 'reflect-metadata';
import { DateTime, Duration } from 'luxon';
import pino from 'pino';
import { closeDB, drizzleDB } from '../../drizzle/db';
import { seedLocations } from './seed/location.seeder';
import { seedAuth } from './seed/auth.seeder';
import { seedInventory } from './seed/inventory.seeder';
import { seedWarehouseManagers } from './seed/warehouse-managers.seeder';
import { seedAssets } from './seed/assets.seeder';
import { seedTax } from './seed/tax.seeder';
import { seedOrganization } from './seed/organization.seeder';
import { seedOrganizationMembers } from './seed/organization-members.seeder';
import { seedOrganizationRoles } from './seed/organization-roles.seeder';
import { seedCompany } from './seed/company.seeder';
import { seedItemCategories } from './seed/item-category.seeder';
import { seedLeaveTypes } from './seed/hr-leave-types.seeder';
import { seedHrEmployees } from './seed/hr.seeder';
import { seedNotificationTemplates } from './seed/notification-templates.seeder';
import { seedNotificationDemo } from './seed/notification-demo.seeder';
import { seedCommerceWebsite } from './seed/commerce-website.seeder';
import { redisClient } from '../../src/providers/redis/redis';

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

	// Stale cache after reseeding points at old rows; clear everything first.
	await redisClient.flushall();
	logger.info('Cache flushed');

	// Company first: every later seeder may allocate a code, and the numbering
	// authority needs the company document code ({COMPANY}).
	await seedCompany();
	await seedAuth();
	await seedLocations(drizzleDB);
	await seedOrganization();
	await seedOrganizationMembers();
	await seedOrganizationRoles();
	await seedItemCategories();
	// Needs the organization (scope), location (address village), the item
	// category rows above; asset placements then reference the warehouse and
	// storage rows it creates.
	await seedInventory();
	// Needs the live warehouse rows above and the seeded `warehouse` role
	// account from `seedOrganizationMembers` (ADR-0017).
	await seedWarehouseManagers();
	await seedAssets();
	await seedTax();
	await seedHrEmployees();
	// M08 leave types are reference rows the attendance/leave records depend on.
	await seedLeaveTypes();
	// Notification templates are reference rows (every environment); the demo
	// rows that reference them are dev-only and need the seed admin, which
	// `seedAuth` created above.
	await seedNotificationTemplates();
	await seedNotificationDemo();
	// ERP-0071: the website identity and menus the site shows today (dev only).
	await seedCommerceWebsite();

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
