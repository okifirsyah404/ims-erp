import { Worker } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { LICENSING_SERVICE_TOKEN } from '../constants/di';
import { LICENSE_DUE_QUEUE_NAME } from './license-due.queue';

/**
 * Runs the daily `license.due` reminders (M04 stage 2). `null` when
 * `scheduler.enabled` is false (tests, scripts): no queue, no Redis traffic.
 * A failed run is retried by the next day's run; the outbox dedupe key keeps
 * reminders single.
 */
export function startLicenseDueWorker(): QueueWorker | null {
	if (!appConfig.scheduler.enabled) return null;
	const service = container.resolve(LICENSING_SERVICE_TOKEN);
	const worker = new Worker(LICENSE_DUE_QUEUE_NAME, async () => service.publishDueNotices(), {
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
