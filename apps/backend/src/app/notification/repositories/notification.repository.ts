import { and, count, desc, eq, isNull, lt, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/tokens';
import { paginationResult } from '@utils/pagination.util';
import {
	pushNotifications,
	pushNotificationTemplates,
	type TPushNotificationSelect,
	type TPushNotificationTemplateSelect,
} from '@drizzle/schemas/notification.schema';
import type {
	IPushNotificationRepository,
	TPushNotificationInsert,
	TPushNotificationPaginationRequest,
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
export class PushNotificationRepository implements IPushNotificationRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	async insert(entry: TPushNotificationInsert): Promise<TPushNotificationSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(pushNotifications)
			.values({
				...entry,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return row as TPushNotificationSelect;
	}

	async findTemplateByCode(
		code: string,
	): Promise<TPushNotificationTemplateSelect | null> {
		const [row] = await this.database
			.select()
			.from(pushNotificationTemplates)
			.where(
				and(
					eq(pushNotificationTemplates.code, code),
					isNull(pushNotificationTemplates.deletedAt),
				),
			)
			.limit(1);

		return (row as TPushNotificationTemplateSelect | undefined) ?? null;
	}

	async findByIdForUser(
		id: string,
		userId: string,
	): Promise<TPushNotificationSelect | null> {
		const [row] = await this.database
			.select()
			.from(pushNotifications)
			.where(
				and(
					eq(pushNotifications.id, id),
					eq(pushNotifications.userId, userId),
					isNull(pushNotifications.deletedAt),
				),
			)
			.limit(1);

		return (row as TPushNotificationSelect | undefined) ?? null;
	}

	/**
	 * Fetches one newest-first page of the caller's inbox.
	 *
	 * @param request - Caller id, page settings, and the `unreadOnly` filter
	 */
	async paginateForUser(
		request: TPushNotificationPaginationRequest,
	): Promise<TPaginationResult<TPushNotificationSelect>> {
		const { userId, page, limit, unreadOnly } = request;
		const where = and(
			eq(pushNotifications.userId, userId),
			isNull(pushNotifications.deletedAt),
			unreadOnly ? ne(pushNotifications.status, 'read') : undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(pushNotifications)
			.where(where);

		const data = await this.database
			.select()
			.from(pushNotifications)
			.where(where)
			.orderBy(desc(pushNotifications.createdAt))
			.offset((page - 1) * limit)
			.limit(limit);

		return paginationResult(request, total, data as TPushNotificationSelect[]);
	}

	async countUnread(userId: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(pushNotifications)
			.where(
				and(
					eq(pushNotifications.userId, userId),
					isNull(pushNotifications.deletedAt),
					ne(pushNotifications.status, 'read'),
				),
			);

		return value;
	}

	async markRead(
		id: string,
		userId: string,
	): Promise<TPushNotificationSelect | null> {
		const [row] = await this.database
			.update(pushNotifications)
			.set({ status: 'read', readAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(pushNotifications.id, id),
					eq(pushNotifications.userId, userId),
					isNull(pushNotifications.deletedAt),
				),
			)
			.returning();

		return (row as TPushNotificationSelect | undefined) ?? null;
	}

	async markAllRead(userId: string): Promise<number> {
		const rows = await this.database
			.update(pushNotifications)
			.set({ status: 'read', readAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(pushNotifications.userId, userId),
					isNull(pushNotifications.deletedAt),
					ne(pushNotifications.status, 'read'),
				),
			)
			.returning({ id: pushNotifications.id });

		return rows.length;
	}

	async pruneRead(cutoff: Date): Promise<number> {
		const rows = await this.database
			.delete(pushNotifications)
			.where(
				and(
					eq(pushNotifications.status, 'read'),
					isNull(pushNotifications.deletedAt),
					lt(pushNotifications.readAt, cutoff),
				),
			)
			.returning({ id: pushNotifications.id });

		return rows.length;
	}
}
