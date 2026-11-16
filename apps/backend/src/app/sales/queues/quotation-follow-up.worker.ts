import { Worker } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { QUOTATION_SERVICE_TOKEN } from '../constants/di';
import { QUOTATION_FOLLOW_UP_QUEUE_NAME } from './quotation-follow-up.queue';

/**
 * Runs the daily `quotation.follow_up_due` reminders (ERP-0066). `null`
 * when `scheduler.enabled` is false (tests, scripts).
 */
export function startQuotationFollowUpWorker(): QueueWorker | null {
	if (!appConfig.scheduler.enabled) return null;
	const service = container.resolve(QUOTATION_SERVICE_TOKEN);
	const worker = new Worker(QUOTATION_FOLLOW_UP_QUEUE_NAME, async () => service.publishFollowUpNotices(), {
		connection: queueConnection,
		concurrency: 1,
	});
	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
