import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import path from 'node:path';
import pino from 'pino';
import { DateTime, Duration } from 'luxon';
import { closeDB, drizzleDB } from '../drizzle/db';
import { runSeeders } from './seeders';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

// Postgres-reserved schemas that must never be dropped. Everything else in
// pg_namespace is an application schema (auth, location, sales, ...) and gets
// wiped, so the migrations journal (inside public) is cleared too.
const SYSTEM_SCHEMAS = new Set([
	'public',
	'information_schema',
]);

async function resetSchemas(): Promise<void> {
	const rows = await drizzleDB.execute<{ nspname: string }>(
		sql`SELECT nspname FROM pg_catalog.pg_namespace
			WHERE nspname <> 'information_schema'
			AND nspname NOT LIKE 'pg_%'`,
	);

	const appSchemas = rows
		.map((row) => row.nspname)
		.filter((name) => !SYSTEM_SCHEMAS.has(name));

	for (const schema of appSchemas) {
		logger.info({ schema }, 'Dropping schema');
		await drizzleDB.execute(
			sql.raw(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`),
		);
	}

	await drizzleDB.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
	await drizzleDB.execute(sql`CREATE SCHEMA public`);
	logger.info('Database reset complete');
}

async function main(): Promise<void> {
	const startedAt = DateTime.now();
	try {
		logger.info({ startedAt: startedAt.toISO() }, 'Migrate-reset started');

		logger.info('Resetting schemas...');
		await resetSchemas();

		logger.info('Running migrations...');
		await migrate(drizzleDB, {
			migrationsFolder: path.join(import.meta.dir, 'migrations'),
		});
		logger.info('Migrations complete');

		logger.info('Seeding...');
		await runSeeders();

		const finishedAt = DateTime.now();
		const elapsed = Duration.fromObject({
			milliseconds: finishedAt.diff(startedAt).milliseconds,
		})
			.shiftTo('hours', 'minutes', 'seconds', 'milliseconds')
			.toHuman();

		logger.info(
			{ finishedAt: finishedAt.toISO(), duration: elapsed },
			'Migrate-reset complete',
		);
	} catch (error) {
		logger.error({ err: error }, 'Migrate-reset failed');
		process.exit(1);
	} finally {
		await closeDB();
	}
}

main().catch((error) => {
	console.error('Migrate-reset failed:', error);
	process.exit(1);
});
