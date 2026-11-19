import { Worker } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { LEAD_SERVICE_TOKEN } from '../constants/di';
import { LEAD_FOLLOW_UP_QUEUE_NAME } from './lead-follow-up.queue';

/**
 * Runs the daily `lead.follow_up_due` reminders (ERP-0066). `null` when
 * `scheduler.enabled` is false (tests, scripts). The outbox dedupe key keeps
 * reminders single when a run repeats.
 */
export function startLeadFollowUpWorker(): QueueWorker | null {
	if (!appConfig.scheduler.enabled) return null;
	const service = container.resolve(LEAD_SERVICE_TOKEN);
	const worker = new Worker(LEAD_FOLLOW_UP_QUEUE_NAME, async () => service.publishFollowUpNotices(), {
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
