import { Queue } from 'bullmq';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue delivering sent quotations: PDF + `quotation.sent` (ERP-0067). */
export const QUOTATION_SENT_QUEUE_NAME = 'quotation-sent';

export type QuotationSentJobData = { quotationId: string };

/** Three tries (30 s, 1 min); the last one publishes without the PDF. */
export const QUOTATION_SENT_ATTEMPTS = 3;

/** Enqueues the delivery of a sent quotation. */
export interface IQuotationSentDispatcher {
	enqueue(quotationId: string, sentAt: Date): Promise<void>;
}

let queue: Queue<QuotationSentJobData> | null = null;

function sentQueue(): Queue<QuotationSentJobData> {
	queue ??= new Queue<QuotationSentJobData>(QUOTATION_SENT_QUEUE_NAME, {
		connection: queueConnection,
		defaultJobOptions: {
			attempts: QUOTATION_SENT_ATTEMPTS,
			backoff: { type: 'exponential', delay: 30_000 },
			removeOnComplete: { age: 86_400, count: 1_000 },
			removeOnFail: { age: 7 * 86_400 },
		},
	});
	return queue;
}

/** {@link IQuotationSentDispatcher} over BullMQ; one job per sending. */
export class BullQuotationSentDispatcher implements IQuotationSentDispatcher {
	async enqueue(quotationId: string, sentAt: Date): Promise<void> {
		await sentQueue().add('deliver', { quotationId }, { jobId: `quotation-sent-${quotationId}-${sentAt.getTime()}` });
	}
}
