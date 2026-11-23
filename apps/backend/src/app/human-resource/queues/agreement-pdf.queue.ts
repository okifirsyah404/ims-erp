import { Queue } from 'bullmq';
import { pinoLogger } from '@providers/logger/logger';
import { queueConnection } from '@providers/queue/queue.connection';
import { injectable } from 'tsyringe';
import type { IAgreementPdfQueue } from '../contracts/employee-document.contract';

/** BullMQ queue carrying one employment-agreement PDF render per job (ERP-0121). */
export const AGREEMENT_PDF_QUEUE_NAME = 'employee-agreement-pdf';

export type TAgreementPdfJob = { documentId: string };

let queue: Queue<TAgreementPdfJob> | null = null;
const queueOf = () => (queue ??= new Queue<TAgreementPdfJob>(AGREEMENT_PDF_QUEUE_NAME, { connection: queueConnection }));

/**
 * Enqueue side of the agreement PDF (grill-me Q20): 3 attempts with
 * exponential backoff; a Redis outage is logged and never fails the claim,
 * the invite or the button that asked for it.
 */
@injectable()
export class AgreementPdfQueue implements IAgreementPdfQueue {
	async enqueue(documentId: string): Promise<void> {
		try {
			await queueOf().add(
				'render',
				{ documentId },
				{ attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
			);
		} catch (error) {
			pinoLogger.error({ err: error, documentId }, 'agreement PDF enqueue failed');
		}
	}
}
