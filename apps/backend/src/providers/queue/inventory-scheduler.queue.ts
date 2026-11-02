import { Queue } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { queueConnection } from '@providers/queue/queue.connection';

/**
 * The recurring-job queue introduced by S4.
 *
 * @remarks
 * Kept in `providers/queue` rather than under a module because it is
 * infrastructure: the first queue in the codebase to carry **repeating** jobs
 * rather than one-shot work. The avatar queue dispatches a job per user; this
 * one is a clock.
 *
 * The scheduler ids are stable strings on purpose — `upsertJobScheduler` keys on
 * them, so re-declaring the same id on every instance and every boot results in
 * exactly one schedule, never a pile of duplicates.
 */
export const INVENTORY_SCHEDULER_QUEUE = 'inventory-scheduler';

/** Marks overdue, unreturned borrowing lines as late. */
export const LATE_RETURN_JOB = 'borrowing-late-sweep';

/** Nulls guest PII on borrowings past their retention window. */
export const GUEST_RETENTION_JOB = 'borrowing-guest-retention-sweep';

/** Result shape each sweep returns, logged by BullMQ as the job's value. */
export type TSweepOutcome = { processed: number; skipped: number };

/**
 * Declares both repeat schedules.
 *
 * @param queue - The queue to register on
 * @remarks
 * Idempotent: calling it twice (or from six instances) leaves two schedules.
 */
export async function registerSweepSchedules(queue: Queue): Promise<void> {
	await queue.upsertJobScheduler(
		LATE_RETURN_JOB,
		{ pattern: appConfig.scheduler.lateSweepCron },
		{ name: LATE_RETURN_JOB, data: {} },
	);
	await queue.upsertJobScheduler(
		GUEST_RETENTION_JOB,
		{ pattern: appConfig.scheduler.retentionSweepCron },
		{ name: GUEST_RETENTION_JOB, data: {} },
	);
}

/** Builds the scheduler queue over the shared Bun Redis connection. */
export function createSchedulerQueue(): Queue {
	return new Queue(INVENTORY_SCHEDULER_QUEUE, { connection: queueConnection });
}
