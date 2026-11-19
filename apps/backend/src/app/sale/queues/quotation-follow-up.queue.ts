import { Queue } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue carrying the daily `quotation.follow_up_due` run (ERP-0066). */
export const QUOTATION_FOLLOW_UP_QUEUE_NAME = 'quotation-follow-up';

/** Stable scheduler id: re-declared on every boot, it stays one schedule. */
export const QUOTATION_FOLLOW_UP_JOB = 'quotation-follow-up-notices';

/** Declares the weekday schedule on the Asia/Jakarta clock. Idempotent. */
export async function registerQuotationFollowUpSchedule(): Promise<void> {
	const queue = new Queue(QUOTATION_FOLLOW_UP_QUEUE_NAME, { connection: queueConnection });
	await queue.upsertJobScheduler(
		QUOTATION_FOLLOW_UP_JOB,
		{ pattern: appConfig.scheduler.salesFollowUpCron, tz: 'Asia/Jakarta' },
		{ name: QUOTATION_FOLLOW_UP_JOB, data: {}, opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 30 } } },
	);
	await queue.close();
}
