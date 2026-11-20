import { inject, injectable } from 'tsyringe';
import { NOTIFICATION_SERVICE_TOKEN } from '../constants/di';
import type { TNotificationView } from '../contracts/notification.contract';
import type { NotificationService } from './notification.service';

/**
 * A user's own in-app inbox for other modules (ERP-0077: the customer portal
 * shows its logins' notifications). Read and mark-read only, always for the
 * user id the caller resolved from its own guard; sending stays on
 * `ExportedNotificationService`.
 */
@injectable()
export class NotificationInboxService {
	constructor(@inject(NOTIFICATION_SERVICE_TOKEN) private readonly notifications: Pick<NotificationService, 'list' | 'unreadCount' | 'markAllRead'>) {}

	/** Newest first. */
	async latest(userId: string, limit = 50): Promise<TNotificationView[]> {
		return (await this.notifications.list(userId, { page: 1, limit, unreadOnly: false })).data;
	}

	unreadCount(userId: string): Promise<number> {
		return this.notifications.unreadCount(userId);
	}

	markAllRead(userId: string): Promise<number> {
		return this.notifications.markAllRead(userId);
	}
}
