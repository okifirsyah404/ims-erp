import { Queue } from 'bullmq';
import { pinoLogger } from '@providers/logger/logger';
import { queueConnection } from '@providers/queue/queue.connection';
import { injectable } from 'tsyringe';
import type { IPayslipQueue } from '../contracts/payslip.contract';

/** BullMQ queue carrying one payslip PDF per approved salary record (ERP-0122). */
export const PAYSLIP_PDF_QUEUE_NAME = 'payslip-pdf';

export type TPayslipPdfJob = { recordId: string };

let queue: Queue<TPayslipPdfJob> | null = null;
const queueOf = () => (queue ??= new Queue<TPayslipPdfJob>(PAYSLIP_PDF_QUEUE_NAME, { connection: queueConnection }));

/**
 * Enqueue side of the payslip PDF (grill-me Q32): 3 attempts with
 * exponential backoff; a Redis outage is logged and never fails the payroll
 * approval or the button that asked for it.
 */
@injectable()
export class PayslipPdfQueue implements IPayslipQueue {
	async enqueue(recordId: string): Promise<void> {
		try {
			await queueOf().add(
				'render',
				{ recordId },
				{ attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
			);
		} catch (error) {
			pinoLogger.error({ err: error, recordId }, 'payslip PDF enqueue failed');
		}
	}
}
