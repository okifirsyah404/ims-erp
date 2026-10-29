import { DateTime, Duration } from 'luxon';
import pino from 'pino';
import { closeDB, drizzleDB } from '../../drizzle/db';
import { seedLocations } from './seed/location.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

async function main(): Promise<void> {
	try {
		const startedAt = DateTime.now();
		logger.info({ startedAt: startedAt.toISO() }, 'Location seeding started');

		await seedLocations(drizzleDB);

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
			'Location seeding complete',
		);
	} catch (error) {
		logger.error({ err: error }, 'Location seeding failed');
		process.exit(1);
	} finally {
		await closeDB();
	}
}

main().catch((error) => {
	console.error('Seeding failed:', error);
	process.exit(1);
});
