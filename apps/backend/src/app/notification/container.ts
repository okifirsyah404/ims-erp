import type { DependencyContainer } from 'tsyringe';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationService } from './services/notification.service';
import { ExportedNotificationService } from './services/exported-notification.service';
import { NotificationInboxService } from './services/notification-inbox.service';
import { dispatchNotification } from './queues/notification.queue';
import {
	EXPORTED_NOTIFICATION_SERVICE_TOKEN,
	NOTIFICATION_INBOX_SERVICE_TOKEN,
	NOTIFICATION_DISPATCHER_TOKEN,
	NOTIFICATION_REPOSITORY_TOKEN,
	NOTIFICATION_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the notification module: repository, in-module service, and the
 * exported producer entry point.
 *
 * @remarks
 * Registration order does not matter here — nothing resolves another token at
 * construction time (unlike `registerAudit` → `registerInventory`). Producers
 * resolve `EXPORTED_NOTIFICATION_SERVICE_TOKEN` lazily through their own
 * constructor injection, so this only has to run before the first request.
 */
export function registerNotification(container: DependencyContainer): void {
	container.register(NOTIFICATION_REPOSITORY_TOKEN, {
		useClass: NotificationRepository,
	});
	container.register(NOTIFICATION_SERVICE_TOKEN, {
		useClass: NotificationService,
	});
	// The enqueue seam. `useValue` (not `useClass`): the dispatcher is a plain
	// function, and a fresh one per resolve would be pointless indirection.
	container.register(NOTIFICATION_DISPATCHER_TOKEN, {
		useValue: dispatchNotification,
	});
	container.register(EXPORTED_NOTIFICATION_SERVICE_TOKEN, {
		useClass: ExportedNotificationService,
	});
	container.register(NOTIFICATION_INBOX_SERVICE_TOKEN, { useClass: NotificationInboxService });
}
