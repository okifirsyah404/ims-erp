import { Queue } from 'bullmq';
import { queueConnection } from '@providers/queue/queue.connection';
import type { IInboundDispatcher } from '../contracts/whatsapp.contract';

/** BullMQ queue that runs the assistant on inbound WhatsApp messages (M04 stage 2). */
export const WHATSAPP_QUEUE_NAME = 'whatsapp-inbound';

export type WhatsappJobData = { messageId: string };

let queue: Queue<WhatsappJobData> | null = null;

function whatsappQueue(): Queue<WhatsappJobData> {
	queue ??= new Queue<WhatsappJobData>(WHATSAPP_QUEUE_NAME, {
		connection: queueConnection,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: 'exponential', delay: 10_000 },
			removeOnComplete: { age: 86_400, count: 1_000 },
			removeOnFail: { age: 7 * 86_400 },
		},
	});
	return queue;
}

/** {@link IInboundDispatcher} over BullMQ; one job per stored message. */
export class BullInboundDispatcher implements IInboundDispatcher {
	async enqueue(messageId: string): Promise<void> {
		await whatsappQueue().add('process', { messageId }, { jobId: `wa-${messageId}` });
	}
}
