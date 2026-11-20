import { DRIZZLE_TOKEN } from '@di/provider';
import { outboxMessages } from '@drizzle/schemas/automation.schema';
import { and, count, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type { IOutboxRepository, TOutboxListQuery } from '../contracts/outbox.contract';

/** Drizzle implementation of {@link IOutboxRepository}. */
@injectable()
export class OutboxRepository implements IOutboxRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async create(data: Parameters<IOutboxRepository['create']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(outboxMessages)
			.values({ ...data, createdAt: now, updatedAt: now })
			.onConflictDoNothing({ target: outboxMessages.dedupeKey })
			.returning();
		return row ?? null;
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(outboxMessages)
			.where(and(eq(outboxMessages.id, id), isNull(outboxMessages.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async paginate({ page, limit, status, topic }: TOutboxListQuery) {
		const where = and(
			isNull(outboxMessages.deletedAt),
			status ? eq(outboxMessages.status, status) : undefined,
			topic ? eq(outboxMessages.topic, topic) : undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(outboxMessages).where(where);
		const data = await this.database
			.select()
			.from(outboxMessages)
			.where(where)
			.orderBy(desc(outboxMessages.createdAt), desc(outboxMessages.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async recordAttempt(id: string, outcome: Parameters<IOutboxRepository['recordAttempt']>[1]) {
		const now = new Date();
		const [row] = await this.database
			.update(outboxMessages)
			.set({
				status: outcome.status,
				responseStatus: outcome.responseStatus,
				errorMessage: outcome.errorMessage?.slice(0, 500) ?? null,
				attempts: sql`${outboxMessages.attempts} + 1`,
				lastAttemptAt: now,
				publishedAt: outcome.status === 'published' ? now : undefined,
				updatedAt: now,
			})
			.where(and(eq(outboxMessages.id, id), isNull(outboxMessages.deletedAt), ne(outboxMessages.status, 'published')))
			.returning();
		return row ?? null;
	}

	async countByStatus() {
		const rows = await this.database
			.select({ status: outboxMessages.status, value: count() })
			.from(outboxMessages)
			.where(isNull(outboxMessages.deletedAt))
			.groupBy(outboxMessages.status);
		return Object.fromEntries(rows.map((row) => [row.status, row.value]));
	}
}
