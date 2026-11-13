/**
 * Public entry point of the notification module.
 *
 * @remarks
 * Other modules import **only** `ExportedNotificationService` (through
 * `EXPORTED_NOTIFICATION_SERVICE_TOKEN`) — never the repository, the queue, or
 * the in-module service (D7).
 *
 * `notificationModule()` (the Elysia plugin with the REST routes) is added in
 * Phase 4: it has no controllers yet, and mounting an empty plugin would only
 * make `createApp()` claim a surface that does not exist.
 */
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
