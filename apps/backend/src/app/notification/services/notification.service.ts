import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import { realtimeMessage } from '@providers/realtime/realtime.message';
import {
	type IRealtimeHub,
	REALTIME_HUB_TOKEN,
} from '@providers/realtime/realtime.hub';
import {
	type TNotificationQuery,
	type TNotificationView,
	toNotificationView,
} from '../contracts/notification.contract';
import type {
	INotificationRepository,
	TNotificationSelect,
} from '../contracts/notification.repository.interface';
import { NOTIFICATION_REPOSITORY_TOKEN } from '../constants/di';
import { NotificationNotFoundError } from '../errors/notification.errors';

/**
 * Read and acknowledgement use cases over the caller's inbox.
 *
 * @remarks
 * Every method takes the caller's `userId` from the session — there is no
 * "any user" variant, so a controller cannot accidentally widen the scope.
 * Ownership is enforced in the repository filter; a row that is not the
 * caller's is indistinguishable from a missing one (404).
 *
 * Read-state changes publish to the same user's other tabs. Server data stays
 * owned by TanStack Query on the client; the frame only tells it to refresh.
 */
@injectable()
export class NotificationService {
	constructor(
		@inject(NOTIFICATION_REPOSITORY_TOKEN)
		private readonly repository: INotificationRepository,
		@inject(REALTIME_HUB_TOKEN)
		private readonly hub: IRealtimeHub,
	) {}

	async list(
		userId: string,
		query: TNotificationQuery,
	): Promise<TPaginationResult<TNotificationView>> {
		const page = await this.repository.listForUser({
			userId,
			page: query.page,
			limit: query.limit,
			unreadOnly: query.unreadOnly,
		});

		return { meta: page.meta, data: page.data.map(toNotificationView) };
	}

	async unreadCount(userId: string): Promise<number> {
		return this.repository.countUnread(userId);
	}

	/** Marks one row read; a row owned by someone else is a 404. */
	async markRead(id: string, userId: string): Promise<TNotificationView> {
		const row = await this.repository.markRead(id, userId);
		if (!row) throw new NotificationNotFoundError();

		this.publish(userId, 'notification.updated', toNotificationView(row));
		await this.publishUnreadCount(userId);

		return toNotificationView(row);
	}

	/** Marks every unread row of the caller read; returns the changed count. */
	async markAllRead(userId: string): Promise<number> {
		const changed = await this.repository.markAllRead(userId);
		await this.publishUnreadCount(userId);
		return changed;
	}

	/**
	 * Resolves one row the caller owns, or throws 404.
	 *
	 * @remarks
	 * Kept on the service (not the repository) so a future endpoint that needs
	 * the row before acting on it reuses the same ownership rule.
	 */
	async assertOwnedBy(
		id: string,
		userId: string,
	): Promise<TNotificationSelect> {
		const row = await this.repository.findByIdForUser(id, userId);
		if (!row) throw new NotificationNotFoundError();
		return row;
	}

	private async publishUnreadCount(userId: string): Promise<void> {
		const count = await this.repository.countUnread(userId);
		this.publish(userId, 'notification.unread_count', { count });
	}

	private publish(userId: string, type: string, data: unknown): void {
		this.hub.publish(userId, realtimeMessage(type, data));
	}
}
