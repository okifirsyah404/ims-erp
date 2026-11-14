import type { TPaginationResult } from '@ims-erp/common';
import type {
	NotificationChannel,
	NotificationStatus,
	TNotificationSelect,
	TNotificationTemplateSelect,
} from '@drizzle/schemas/notification.schema';

/**
 * Data-access contract over the `notification` schema (ERP-0047).
 *
 * @remarks
 * One repository owns both tables of the module: the inbox
 * (`notification.notifications`) and the template lookup the worker needs
 * (`notification.notification_templates`). Services hold no Drizzle handle.
 *
 * Reads filter `deleted_at IS NULL`; `pruneRead` is the only hard delete and
 * exists because retention is the point of the job (D10), not a feature-level
 * delete.
 */

/** One row to append to the inbox, before the repository stamps timestamps. */
export type TNotificationInsert = {
	userId: string;
	notificationTemplateId: string | null;
	templateCode: string;
	title: string;
	body: string | null;
	tags: string[];
	variables: Record<string, string> | null;
	metadata: Record<string, unknown> | null;
	channel: NotificationChannel;
	status: NotificationStatus;
	sentAt: Date | null;
	sourceType: string | null;
	sourceId: string | null;
};

/** Caller-scoped list request. `unreadOnly` excludes rows already read. */
export type TNotificationListRequest = {
	userId: string;
	page: number;
	limit: number;
	unreadOnly: boolean;
};

export interface INotificationRepository {
	/** Appends one inbox row and returns it as stored. */
	insert(entry: TNotificationInsert): Promise<TNotificationSelect>;

	/** Resolves an active template by its `module.event` code. */
	findTemplateByCode(
		code: string,
	): Promise<TNotificationTemplateSelect | null>;

	/** One row, only when it belongs to the caller. */
	findByIdForUser(
		id: string,
		userId: string,
	): Promise<TNotificationSelect | null>;

	/** Newest-first page of the caller's inbox. */
	listForUser(
		request: TNotificationListRequest,
	): Promise<TPaginationResult<TNotificationSelect>>;

	/** Unread rows for one user. */
	countUnread(userId: string): Promise<number>;

	/** Marks one row read; `null` when it is missing or not the caller's. */
	markRead(id: string, userId: string): Promise<TNotificationSelect | null>;

	/** Marks every unread row of the caller; returns how many changed. */
	markAllRead(userId: string): Promise<number>;

	/**
	 * Hard-deletes read rows whose `read_at` is older than `cutoff`.
	 *
	 * @returns How many rows were removed.
	 */
	pruneRead(cutoff: Date): Promise<number>;
}

export type { TNotificationSelect };
