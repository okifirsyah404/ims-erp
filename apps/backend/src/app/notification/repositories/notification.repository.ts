import { and, count, desc, eq, isNull, lt, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/tokens';
import {
	notifications,
	notificationTemplates,
	type TNotificationSelect,
	type TNotificationTemplateSelect,
} from '@drizzle/schemas/notification.schema';
import type {
	INotificationRepository,
	TNotificationInsert,
	TNotificationListRequest,
} from '../contracts/notification.repository.interface';

/**
 * Persistence for the notification module: the inbox and its templates.
 *
 * @remarks
 * Every statement against `notification.*` lives here. Read paths exclude
 * soft-deleted rows; `pruneRead` is the deliberate exception and hard-deletes
 * because retention (D10) is a storage rule, not a feature-level delete.
 */
@injectable()
export class NotificationRepository implements INotificationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async insert(entry: TNotificationInsert): Promise<TNotificationSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(notifications)
			.values({
				...entry,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return row as TNotificationSelect;
	}

	async findTemplateByCode(
		code: string,
	): Promise<TNotificationTemplateSelect | null> {
		const [row] = await this.database
			.select()
			.from(notificationTemplates)
			.where(
				and(
					eq(notificationTemplates.code, code),
					isNull(notificationTemplates.deletedAt),
				),
			)
			.limit(1);

		return (row as TNotificationTemplateSelect | undefined) ?? null;
	}

	async findByIdForUser(
		id: string,
		userId: string,
	): Promise<TNotificationSelect | null> {
		const [row] = await this.database
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.id, id),
					eq(notifications.userId, userId),
					isNull(notifications.deletedAt),
				),
			)
			.limit(1);

		return (row as TNotificationSelect | undefined) ?? null;
	}

	async listForUser(
		request: TNotificationListRequest,
	): Promise<TPaginationResult<TNotificationSelect>> {
		const { userId, page, limit, unreadOnly } = request;
		const where = and(
			eq(notifications.userId, userId),
			isNull(notifications.deletedAt),
			unreadOnly ? ne(notifications.status, 'read') : undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(notifications)
			.where(where);

		const data = await this.database
			.select()
			.from(notifications)
			.where(where)
			.orderBy(desc(notifications.createdAt))
			.offset((page - 1) * limit)
			.limit(limit);

		return {
			data: data as TNotificationSelect[],
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
		};
	}

	async countUnread(userId: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, userId),
					isNull(notifications.deletedAt),
					ne(notifications.status, 'read'),
				),
			);

		return value;
	}

	async markRead(
		id: string,
		userId: string,
	): Promise<TNotificationSelect | null> {
		const [row] = await this.database
			.update(notifications)
			.set({ status: 'read', readAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(notifications.id, id),
					eq(notifications.userId, userId),
					isNull(notifications.deletedAt),
				),
			)
			.returning();

		return (row as TNotificationSelect | undefined) ?? null;
	}

	async markAllRead(userId: string): Promise<number> {
		const rows = await this.database
			.update(notifications)
			.set({ status: 'read', readAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(notifications.userId, userId),
					isNull(notifications.deletedAt),
					ne(notifications.status, 'read'),
				),
			)
			.returning({ id: notifications.id });

		return rows.length;
	}

	async pruneRead(cutoff: Date): Promise<number> {
		const rows = await this.database
			.delete(notifications)
			.where(
				and(
					eq(notifications.status, 'read'),
					isNull(notifications.deletedAt),
					lt(notifications.readAt, cutoff),
				),
			)
			.returning({ id: notifications.id });

		return rows.length;
	}
}
