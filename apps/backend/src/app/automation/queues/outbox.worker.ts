import { UnrecoverableError, Worker } from 'bullmq';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { OUTBOX_SERVICE_TOKEN } from '../constants/di';
import { OUTBOX_QUEUE_NAME, type OutboxJobData } from './outbox.queue';

/**
 * Delivers queued outbox events (M04). A retryable failure (n8n down, 5xx,
 * 408/429) throws so BullMQ retries with backoff; a client error or an
 * unconfigured webhook stops the retries — the event stays on the log for a
 * manual send.
 */
export function startOutboxWorker(): QueueWorker {
	const service = container.resolve(OUTBOX_SERVICE_TOKEN);
	const worker = new Worker<OutboxJobData>(
		OUTBOX_QUEUE_NAME,
		async (job) => {
			const { message, retryable } = await service.deliver(job.data.outboxId);
			if (message.status === 'published' || message.status === 'pending') return message.status;
			if (retryable) throw new Error(message.errorMessage ?? 'Delivery failed');
			throw new UnrecoverableError(message.errorMessage ?? 'Delivery rejected');
		},
		{ connection: queueConnection, concurrency: 2 },
	);
	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
