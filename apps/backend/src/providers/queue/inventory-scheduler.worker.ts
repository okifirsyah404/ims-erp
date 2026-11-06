import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import { BORROWING_SERVICE_TOKEN } from '../../app/assets/constants/di';
import type { BorrowingService } from '../../app/assets/services/borrowing.service';
import {
	GUEST_RETENTION_JOB,
	INVENTORY_SCHEDULER_QUEUE,
	LATE_RETURN_JOB,
	type TSweepOutcome,
} from './inventory-scheduler.queue';

/**
 * Runs one scheduler job.
 *
 * @param borrowingService - Resolved at the bootstrap boundary
 * @param job - The BullMQ job
 * @remarks
 * Split out from {@link startInventorySchedulerWorker} so the dispatch is
 * testable with a plain object and no Redis. An unrecognised job name resolves
 * as a no-op rather than throwing: throwing would retry forever, and an unknown
 * name is a deployment skew, not a transient fault.
 */
export async function processSchedulerJob(
	borrowingService: BorrowingService,
	job: Pick<Job, 'name'>,
): Promise<TSweepOutcome> {
	if (job.name === LATE_RETURN_JOB) {
		return borrowingService.sweepLate();
	}
	if (job.name === GUEST_RETENTION_JOB) {
		return borrowingService.sweepGuestRetention(
			appConfig.scheduler.guestPiiRetentionMonths,
		);
	}
	return { processed: 0, skipped: 0 };
}

/**
 * Starts the borrowing scheduler worker. Call once at bootstrap.
 *
 * @returns The worker, or `null` when `scheduler.enabled` is false
 * @remarks
 * **Returns `null` rather than not existing** so `index.ts` can stay linear and
 * a test can boot the whole app with scheduling disabled. Nothing is registered
 * when disabled — no queue, no worker, no Redis traffic.
 *
 * `concurrency: 1` is deliberate: the two sweeps touch the same rows, and a
 * single slot makes their interleaving impossible to reason about.
 */
export function startInventorySchedulerWorker(): {
	worker: Worker;
} | null {
	if (!appConfig.scheduler.enabled) return null;

	// Resolved once at the bootstrap boundary, matching `startAvatarWorker`:
	// the worker outlives the request lifecycle.
	const borrowingService = container.resolve<BorrowingService>(
		BORROWING_SERVICE_TOKEN,
	);

	const worker = new Worker(
		INVENTORY_SCHEDULER_QUEUE,
		async (job) => processSchedulerJob(borrowingService, job),
		{
			connection: queueConnection,
			concurrency: 1,
		},
	);

	return { worker };
}
