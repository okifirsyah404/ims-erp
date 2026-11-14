/**
 * Public entry point of the notification module.
 *
 * @remarks
 * Other modules import **only** `ExportedNotificationService` (through
 * `EXPORTED_NOTIFICATION_SERVICE_TOKEN`) — never the repository, the queue, or
 * the in-module service (D7). `notificationModule()` is the HTTP surface and is
 * mounted by `createApp()`.
 */
import Elysia from 'elysia';

import { NotificationController } from './controllers/notification.controller';

export * from './container';
export type {
	INotificationRepository,
	TNotificationInsert,
	TNotificationListRequest,
} from './contracts/notification.repository.interface';
export type {
	TNotificationView,
	TNotificationQuery,
} from './contracts/notification.contract';
export type { TNotifyInput } from './services/exported-notification.service';
export { NotificationNotFoundError } from './errors/notification.errors';

export {
	NOTIFICATION_QUEUE_NAME,
	NOTIFICATION_SEND_JOB,
	NOTIFICATION_PRUNE_JOB,
	type NotificationSendJobData,
	createNotificationQueue,
	dispatchNotification,
	notificationJobId,
	registerNotificationSchedules,
} from './queues/notification.queue';
export {
	type NotificationWorkerHandle,
	processNotificationPruneJob,
	processNotificationSendJob,
	renderNotificationText,
	startNotificationWorker,
} from './queues/notification.worker';

/** Elysia instance mounting every notification controller. */
export function notificationModule() {
	return new Elysia({ name: 'notification' }).use(
		NotificationController.plugin(),
	);
}
