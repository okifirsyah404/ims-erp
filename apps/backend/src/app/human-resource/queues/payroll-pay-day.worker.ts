import { Worker } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { PAYROLL_SCHEDULE_SERVICE_TOKEN } from '../constants/di';
import { PAYROLL_PAY_DAY_QUEUE_NAME } from './payroll-pay-day.queue';

/**
 * Runs the daily payroll draft tick (ERP-0120). `null` when
 * `scheduler.enabled` is false (tests, scripts): no queue, no Redis traffic.
 * A failed tick is retried by the next day's; the draft run itself skips rows
 * that already exist, so a late rerun on payday never duplicates.
 */
export function startPayrollPayDayWorker(): QueueWorker | null {
	if (!appConfig.scheduler.enabled) return null;
	const service = container.resolve(PAYROLL_SCHEDULE_SERVICE_TOKEN);
	const worker = new Worker(PAYROLL_PAY_DAY_QUEUE_NAME, async () => service.runDaily(), {
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
