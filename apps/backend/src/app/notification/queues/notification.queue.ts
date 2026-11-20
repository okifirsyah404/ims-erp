import { Queue } from 'bullmq';
import { appConfig } from '@config/providers/config';
import { queueConnection } from '@providers/queue/queue.connection';
import type { PushNotificationTemplateCode } from '@drizzle/schemas/notification.schema';

/**
 * BullMQ queue backing the notification inbox (D5).
 *
 * @remarks
 * Producers never insert rows: `ExportedNotificationService` enqueues a `send`
 * job and the worker owns the insert and the socket publish. The queue also
 * carries the `prune` repeat job (D10).
 */
export const NOTIFICATION_QUEUE_NAME = 'notification';

/** One-shot job: render one template for one recipient. */
export const NOTIFICATION_SEND_JOB = 'send';

/** Repeat job: hard-delete read rows past the retention window. */
export const NOTIFICATION_PRUNE_JOB = 'prune';

/** Payload of a `send` job. */
export type NotificationSendJobData = {
	userId: string;
	templateCode: PushNotificationTemplateCode;
	variables: Record<string, string>;
	tags: string[];
	sourceType: string | null;
	sourceId: string | null;
	metadata: Record<string, unknown> | null;
};

export const notificationQueue = new Queue<NotificationSendJobData>(
	NOTIFICATION_QUEUE_NAME,
	{
		connection: queueConnection,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: 'exponential', delay: 2_000 },
			removeOnComplete: { age: 3_600, count: 1_000 },
			removeOnFail: { age: 86_400 },
		},
	},
);

/** Stable job id for one `(template, recipient, event)` triple. */
export function notificationJobId(input: {
	templateCode: string;
	userId: string;
	sourceId?: string | null;
	variables?: Record<string, string>;
}): string {
	// NOTE: BullMQ reserves ':' in custom job ids (repeatable-job key
	// delimiter), so the separator is a dash. The event's `sourceId` is the
	// preferred suffix; without one the variables are hashed so a replayed
	// producer call dedupes while two different organizations do not collide.
	const suffix = input.sourceId ?? hashVariables(input.variables ?? {});
	return `notification-${input.templateCode}-${input.userId}-${suffix}`;
}

/** Enqueues one `send` job. */
export async function dispatchNotification(
	data: NotificationSendJobData,
): Promise<void> {
	await notificationQueue.add(NOTIFICATION_SEND_JOB, data, {
		jobId: notificationJobId(data),
	});
}

/**
 * Declares the retention schedule.
 *
 * @remarks
 * Idempotent: `upsertJobScheduler` keys on the job name, so every boot and
 * every instance converge on one schedule.
 */
export async function registerNotificationSchedules(queue: Queue): Promise<void> {
	await queue.upsertJobScheduler(
		NOTIFICATION_PRUNE_JOB,
		{ pattern: appConfig.scheduler.notificationRetentionCron },
		{ name: NOTIFICATION_PRUNE_JOB, data: {} },
	);
}

/** Builds a queue handle for schedule registration at bootstrap. */
export function createNotificationQueue(): Queue {
	return new Queue(NOTIFICATION_QUEUE_NAME, { connection: queueConnection });
}

/** djb2 over a canonical form, so key order never changes the id. */
function hashVariables(variables: Record<string, string>): string {
	const canonical = Object.keys(variables)
		.sort()
		.map((key) => `${key}=${variables[key]}`)
		.join('&');

	let hash = 5381;
	for (let index = 0; index < canonical.length; index += 1) {
		hash = ((hash << 5) + hash + canonical.charCodeAt(index)) | 0;
	}
	return (hash >>> 0).toString(36);
}
