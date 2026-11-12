import { Queue } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue carrying the daily `license.due` reminder run (M04 stage 2). */
export const LICENSE_DUE_QUEUE_NAME = 'licensing-due';

/** Stable scheduler id: re-declared on every boot, it stays one schedule. */
export const LICENSE_DUE_JOB = 'license-due-notices';

/**
 * Declares the daily schedule on the Asia/Jakarta clock (business dates are
 * Jakarta dates). Idempotent across boots and instances.
 */
export async function registerLicenseDueSchedule(): Promise<void> {
	const queue = new Queue(LICENSE_DUE_QUEUE_NAME, { connection: queueConnection });
	await queue.upsertJobScheduler(
		LICENSE_DUE_JOB,
		{ pattern: appConfig.scheduler.licenseDueCron, tz: 'Asia/Jakarta' },
		{ name: LICENSE_DUE_JOB, data: {}, opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 30 } } },
	);
	await queue.close();
}
