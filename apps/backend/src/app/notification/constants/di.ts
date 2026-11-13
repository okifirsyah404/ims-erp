import type { InjectionToken } from 'tsyringe';
import type { INotificationRepository } from '../contracts/notification.repository.interface';
import type { NotificationService } from '../services/notification.service';
import type {
	ExportedNotificationService,
	TNotificationDispatcher,
} from '../services/exported-notification.service';

/**
 * Injection tokens for the notification module.
 *
 * @remarks
 * `NOTIFICATION_SERVICE_TOKEN` is the in-module read/update surface (Phase 4
 * controllers). `EXPORTED_NOTIFICATION_SERVICE_TOKEN` is the **only** entry
 * point other modules may use (D7): producers depend on the token, never on
 * the repository or the queue.
 *
 * `NOTIFICATION_DISPATCHER_TOKEN` exists because `ExportedNotificationService`
 * takes its enqueue seam as a constructor parameter: with a defaulted parameter
 * the emitted design type is `Object`, which tsyringe refuses to resolve
 * (`TypeInfo not known for "Object"`). Registering the real queue under a token
 * keeps the seam injectable and the class constructible by hand in tests.
 */
export const NOTIFICATION_REPOSITORY_TOKEN: InjectionToken<INotificationRepository> =
	Symbol('NOTIFICATION_REPOSITORY');

export const NOTIFICATION_SERVICE_TOKEN: InjectionToken<NotificationService> =
	Symbol('NOTIFICATION_SERVICE');

export const NOTIFICATION_DISPATCHER_TOKEN: InjectionToken<TNotificationDispatcher> =
	Symbol('NOTIFICATION_DISPATCHER');

export const EXPORTED_NOTIFICATION_SERVICE_TOKEN: InjectionToken<ExportedNotificationService> =
	Symbol('EXPORTED_NOTIFICATION_SERVICE');
