import { Queue } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue carrying the daily payroll draft run (ERP-0120). */
export const PAYROLL_PAY_DAY_QUEUE_NAME = 'payroll-pay-day';

/** Stable scheduler id: re-declared on every boot, it stays one schedule. */
export const PAYROLL_PAY_DAY_JOB = 'payroll-pay-day-drafts';

/**
 * Declares the daily tick on the Asia/Jakarta clock (01:00 WIB by default,
 * `SCHEDULER_PAYROLL_CRON`). The tick itself decides whether today is payday.
 * Idempotent across boots and instances.
 */
export async function registerPayrollPayDaySchedule(): Promise<void> {
	const queue = new Queue(PAYROLL_PAY_DAY_QUEUE_NAME, { connection: queueConnection });
	await queue.upsertJobScheduler(
		PAYROLL_PAY_DAY_JOB,
		{ pattern: appConfig.scheduler.payrollCron, tz: 'Asia/Jakarta' },
		{ name: PAYROLL_PAY_DAY_JOB, data: {}, opts: { removeOnComplete: { count: 30 }, removeOnFail: { count: 30 } } },
	);
	await queue.close();
}
