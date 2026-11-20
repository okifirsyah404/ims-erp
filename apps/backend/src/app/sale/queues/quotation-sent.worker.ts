import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { QUOTATION_DELIVERY_SERVICE_TOKEN } from '../constants/di';
import { QUOTATION_SENT_ATTEMPTS, QUOTATION_SENT_QUEUE_NAME, type QuotationSentJobData } from './quotation-sent.queue';

/**
 * Delivers sent quotations (ERP-0067): one at a time, because each render
 * starts a headless Chromium.
 */
export function startQuotationSentWorker(): QueueWorker {
	const service = container.resolve(QUOTATION_DELIVERY_SERVICE_TOKEN);
	const worker = new Worker<QuotationSentJobData>(
		QUOTATION_SENT_QUEUE_NAME,
		async (job) => service.deliver(job.data.quotationId, job.attemptsMade + 1 >= QUOTATION_SENT_ATTEMPTS),
		{ connection: queueConnection, concurrency: 1 },
	);
	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
