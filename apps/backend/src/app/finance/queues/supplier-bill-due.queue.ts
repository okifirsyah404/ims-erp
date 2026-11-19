import { Queue } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue carrying the daily `supplier_bill.due` reminder run (ERP-0012). */
export const SUPPLIER_BILL_DUE_QUEUE_NAME = 'supplier-bill-due';

/** Stable scheduler id: re-declared on every boot, it stays one schedule. */
export const SUPPLIER_BILL_DUE_JOB = 'supplier-bill-due-notices';

/**
 * Declares the daily schedule on the Asia/Jakarta clock (due dates are
 * Jakarta business dates). Idempotent across boots and instances.
 */
export async function registerSupplierBillDueSchedule(): Promise<void> {
	const queue = new Queue(SUPPLIER_BILL_DUE_QUEUE_NAME, { connection: queueConnection });
	await queue.upsertJobScheduler(
		SUPPLIER_BILL_DUE_JOB,
		{ pattern: appConfig.scheduler.billDueCron, tz: 'Asia/Jakarta' },
		{ name: SUPPLIER_BILL_DUE_JOB, data: {}, opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 30 } } },
	);
	await queue.close();
}
