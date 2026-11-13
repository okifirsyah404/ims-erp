import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { appConfig } from '@config/providers/config';
import { pinoLogger } from '@providers/logger/logger';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { realtimeMessage } from '@providers/realtime/realtime.message';
import {
	type IRealtimeHub,
	REALTIME_HUB_TOKEN,
} from '@providers/realtime/realtime.hub';
import { toNotificationView } from '../contracts/notification.contract';
import type { INotificationRepository } from '../contracts/notification.repository.interface';
import { NOTIFICATION_REPOSITORY_TOKEN } from '../constants/di';
import {
	NOTIFICATION_PRUNE_JOB,
	NOTIFICATION_QUEUE_NAME,
	NOTIFICATION_SEND_JOB,
	type NotificationSendJobData,
} from './notification.queue';

/** What a `send` job produced; BullMQ stores it as the job's return value. */
export type NotificationSendOutcome =
	| { status: 'sent'; notificationId: string }
	| { status: 'skipped'; reason: string };

/**
 * Fills `{{variable}}` placeholders. A missing variable becomes an empty
 * string: the template declares what it needs and the producer is expected to
 * supply it, so a leftover brace in the UI would be worse than a gap.
 */
export function renderNotificationText(
	template: string | null | undefined,
	variables: Record<string, string>,
): string {
	if (!template) return '';
	return template.replace(
		/\{\{\s*(\w+)\s*\}\}/g,
		(_match, key: string) => variables[key] ?? '',
	);
}

/**
 * Creates the inbox row as `sent` (D5) and pushes it to the recipient's open
 * sockets. A missing or inactive template is a **permanent** failure — the job
 * is skipped and not retried, because retrying cannot create the template.
 */
export async function processNotificationSendJob(
	repository: INotificationRepository,
	hub: IRealtimeHub,
	data: NotificationSendJobData,
): Promise<NotificationSendOutcome> {
	const template = await repository.findTemplateByCode(data.templateCode);
	if (!template || !template.isActive) {
		pinoLogger.warn(
			{ templateCode: data.templateCode },
			'notification template missing or inactive; job skipped',
		);
		return { status: 'skipped', reason: 'template-unavailable' };
	}

	const now = new Date();
	const row = await repository.insert({
		userId: data.userId,
		notificationTemplateId: template.id,
		templateCode: data.templateCode,
		title:
			renderNotificationText(template.subjectTemplate, data.variables) ||
			template.name,
		body: renderNotificationText(template.bodyTemplate, data.variables) || null,
		tags: data.tags,
		variables: data.variables,
		metadata: data.metadata,
		channel: template.channel,
		status: 'sent',
		sentAt: now,
		sourceType: data.sourceType,
		sourceId: data.sourceId,
	});

	hub.publish(
		data.userId,
		realtimeMessage('notification.created', toNotificationView(row)),
	);

	return { status: 'sent', notificationId: row.id };
}

/** Hard-deletes read rows past the retention window (D10). */
export async function processNotificationPruneJob(
	repository: INotificationRepository,
	retentionDays: number = appConfig.scheduler.notificationRetentionDays,
): Promise<{ removed: number }> {
	const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1_000);
	const removed = await repository.pruneRead(cutoff);
	if (removed > 0) {
		pinoLogger.info({ removed, retentionDays }, 'pruned read notifications');
	}
	return { removed };
}

/** Handle supervised by `startWorkers()`; same shape as the avatar worker. */
export type NotificationWorkerHandle = QueueWorker;

/**
 * Starts the notification worker. Call once at bootstrap.
 *
 * @remarks
 * Repository and hub are resolved at the bootstrap boundary, like every other
 * worker: they outlive the request lifecycle.
 */
export function startNotificationWorker(): NotificationWorkerHandle {
	const repository = container.resolve<INotificationRepository>(
		NOTIFICATION_REPOSITORY_TOKEN,
	);
	const hub = container.resolve<IRealtimeHub>(REALTIME_HUB_TOKEN);

	const worker = new Worker<NotificationSendJobData>(
		NOTIFICATION_QUEUE_NAME,
		async (job) => {
			if (job.name === NOTIFICATION_SEND_JOB) {
				return processNotificationSendJob(repository, hub, job.data);
			}
			if (job.name === NOTIFICATION_PRUNE_JOB) {
				return processNotificationPruneJob(repository);
			}
			// Unknown job name: do not fail the queue on a stale deployment.
			return { status: 'skipped', reason: 'unknown-job' };
		},
		{ connection: queueConnection, concurrency: 5 },
	);

	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
