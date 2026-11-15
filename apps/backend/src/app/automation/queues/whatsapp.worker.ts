import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { ASSISTANT_SERVICE_TOKEN } from '../constants/di';
import { WHATSAPP_QUEUE_NAME, type WhatsappJobData } from './whatsapp.queue';

/**
 * Runs the assistant on inbound WhatsApp messages (M04 stage 2), one at a
 * time per process so a chat's replies keep their order.
 */
export function startWhatsappWorker(): QueueWorker {
	const service = container.resolve(ASSISTANT_SERVICE_TOKEN);
	const worker = new Worker<WhatsappJobData>(WHATSAPP_QUEUE_NAME, async (job) => service.process(job.data.messageId), {
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
