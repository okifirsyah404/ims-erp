import 'reflect-metadata';
import { DateTime, Duration } from 'luxon';
import pino from 'pino';
import { and, eq } from 'drizzle-orm';
import { closeDB, drizzleDB } from '../../drizzle/db';
import { organizations } from '../../drizzle/schemas/auth.schema';
import { village } from '../../drizzle/schemas/location.schema';
import { isProductionEnv } from '../../config/providers/env';
import { seedLocations } from './seed/location.seeder';
import { seedAuth } from './seed/auth.seeder';
import { seedProduct } from './seed/product.seeder';
import { seedWarehouse } from './seed/warehouse.seeder';
import { seedInventory } from './seed/inventory.seeder';
import { seedWarehouseManagers } from './seed/warehouse-managers.seeder';
import { seedFinance } from './seed/finance.seeder';
import { seedChartOfAccounts } from './seed/chart-of-accounts.seeder';
import { seedTax } from './seed/tax.seeder';
import { SEED_ORGANIZATION_SLUG, seedOrganization } from './seed/organization.seeder';
import { seedOrganizationMembers } from './seed/organization-members.seeder';
import { seedOrganizationRoles } from './seed/organization-roles.seeder';
import { seedCompany } from './seed/company.seeder';
import { seedLeaveTypes } from './seed/hr-leave-types.seeder';
import { seedPurchaseTermTemplates } from './seed/procurement-term-templates.seeder';
import { seedHrEmployees } from './seed/hr.seeder';
import { seedHrSchedules } from './seed/hr-schedules.seeder';
import { seedHrSalaries } from './seed/hr-salaries.seeder';
import { seedHrDocuments } from './seed/hr-documents.seeder';
import { seedDemoProject } from './seed/project-demo.seeder';
import { seedDemoLeads } from './seed/lead-demo.seeder';
import { seedDemoSuppliers } from './seed/supplier-demo.seeder';
import { seedPortalDemo } from './seed/portal-demo.seeder';
import { seedNotificationTemplates } from './seed/notification-templates.seeder';
import { seedNotificationDemo } from './seed/notification-demo.seeder';
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
	// ADR-0026: the product master and the warehouse estate are their own
	// modules now, and the inventory fixtures reference both.
	await seedProduct();
	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	const [villageRow] = await drizzleDB.select({ id: village.id }).from(village).limit(1);
	const estate = await seedWarehouse({
		organizationId: organization?.id ?? null,
		villageId: villageRow?.id ?? null,
		isProduction: isProductionEnv(),
	});
	if (estate) await seedInventory(estate);
	// Needs the live warehouse rows above and the seeded `warehouse` role
	// account from `seedOrganizationMembers` (ADR-0017).
	await seedWarehouseManagers();
	// COA first: `seedFinance` links the cash/bank accounts to its `1-1xxx` rows.
	await seedChartOfAccounts();
	await seedFinance();
	await seedTax();
	await seedHrEmployees();
	// Needs the employees above (ERP-0118).
	await seedHrSchedules();
	// Salary periods + payee accounts of the employees above (ERP-0119).
	await seedHrSalaries();
	// Draft employment agreements of the employees above (ERP-0121).
	await seedHrDocuments();
	// Demo project for the employee portal (Phase B): PIC employee, site
	// coordinates and the attendance radius. Needs the HR employees above.
	await seedDemoProject();
	// Demo leads for the lead form (P7-6 / FU1): passed, upcoming and no follow-up.
	await seedDemoLeads();
	// Demo suppliers for document numbering (P7-5): two short codes, one long legacy code.
	await seedDemoSuppliers();
	// A pending leave request, an approved overtime record and the portal account
	// printed for a manual walk-through.
	await seedPortalDemo();
	// M08 leave types are reference rows the attendance/leave records depend on.
	await seedLeaveTypes();
	// ERP-0165: starter purchase term templates (reference rows, every environment).
	await seedPurchaseTermTemplates();
	// Notification templates are reference rows (every environment); the demo
	// rows that reference them are dev-only and need the seed admin, which
	// `seedAuth` created above.
	await seedNotificationTemplates();
	await seedNotificationDemo();

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


