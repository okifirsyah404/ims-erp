import { Queue } from 'bullmq';
import { queueConnection } from '@providers/queue/queue.connection';
import type { IOutboxDispatcher } from '../contracts/outbox.contract';

/** BullMQ queue that delivers outbox events to n8n (M04). */
export const OUTBOX_QUEUE_NAME = 'automation-outbox';

export type OutboxJobData = { outboxId: string };

/** Five tries with exponential backoff (30 s, 1 min, 2 min, 4 min …). */
export const OUTBOX_ATTEMPTS = 5;

let queue: Queue<OutboxJobData> | null = null;

function outboxQueue(): Queue<OutboxJobData> {
	queue ??= new Queue<OutboxJobData>(OUTBOX_QUEUE_NAME, {
		connection: queueConnection,
		defaultJobOptions: {
			attempts: OUTBOX_ATTEMPTS,
			backoff: { type: 'exponential', delay: 30_000 },
			removeOnComplete: { age: 86_400, count: 1_000 },
			removeOnFail: { age: 7 * 86_400 },
		},
	});
	return queue;
}

/**
 * {@link IOutboxDispatcher} over BullMQ. The job id is derived from the event
 * id (BullMQ reserves `:`), so an event is queued at most once.
 */
export class BullOutboxDispatcher implements IOutboxDispatcher {
	async enqueue(outboxId: string): Promise<void> {
		await outboxQueue().add('deliver', { outboxId }, { jobId: `outbox-${outboxId}` });
	}
}
