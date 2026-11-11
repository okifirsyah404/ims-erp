import { Worker } from 'bullmq';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { MAIL_QUEUE_NAME, type MailJobData } from './mailer.queue';
import { resolveMailTransport } from './mailer.transport';

/** Per-send ceiling so a hung SMTP socket cannot pin a worker slot. */
const SEND_TIMEOUT_MS = 15_000;

/**
 * Delivers one email job through the resolved transport. Throws on failure —
 * BullMQ retries with exponential backoff per the queue's defaultJobOptions.
 */
export async function processMailJob(
	transport: NonNullable<ReturnType<typeof resolveMailTransport>>,
	job: { data: MailJobData },
): Promise<void> {	await Promise.race([
		transport.send(job.data),
		new Promise<never>((_, reject) =>
			setTimeout(
				() => reject(new Error(`mail send timed out after ${SEND_TIMEOUT_MS}ms`)),
				SEND_TIMEOUT_MS,
			),
		),
	]);
}

/**
 * Starts the mail worker, or returns `null` when no transport is configured
 * (same disabled mode as the inventory scheduler — no Redis/SMTP in tests).
 */
export function startMailWorker(): QueueWorker | null {
	const transport = resolveMailTransport();
	if (!transport) return null;

	const worker = new Worker<MailJobData>(
		MAIL_QUEUE_NAME,
		async (job) => processMailJob(transport, job),
		{
			connection: queueConnection,
			concurrency: 2,
		},
	);

	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
