import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { tickets, type TTicketSelect } from '@drizzle/schemas/ticket.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import { and, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ITicketRepository, TTicketCreateData, TTicketListQuery } from '../contracts/ticket.contract';

/** Drizzle implementation of {@link ITicketRepository}. */
@injectable()
export class TicketRepository implements ITicketRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate(query: TTicketListQuery & { assigneeUserId?: string }): Promise<TPaginationResult<TTicketSelect>> {
		const { page, limit, search, status, assigneeUserId } = query;
		const where = and(
			isNull(tickets.deletedAt),
			status ? eq(tickets.status, status) : undefined,
			assigneeUserId ? eq(tickets.assigneeUserId, assigneeUserId) : undefined,
			search
				? or(
						ilike(tickets.code, likePattern(search)),
						ilike(tickets.customerName, likePattern(search)),
						ilike(tickets.serialNumber, likePattern(search)),
						ilike(tickets.complaint, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(tickets).where(where);
		const data = await this.database
			.select()
			.from(tickets)
			.where(where)
			.orderBy(desc(tickets.reportedAt), desc(tickets.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult({ page, limit }, total, data);
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(tickets)
			.where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async listByCustomer(customerId: string) {
		return this.database
			.select()
			.from(tickets)
			.where(and(eq(tickets.customerId, customerId), isNull(tickets.deletedAt)))
			.orderBy(desc(tickets.reportedAt), desc(tickets.id))
			.limit(200);
	}

	async create(data: TTicketCreateData, tx?: TTx) {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.insert(tickets)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async transition(id: string, from: TTicketSelect['status'][], data: Parameters<ITicketRepository['transition']>[2]) {
		const [row] = await this.database
			.update(tickets)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(tickets.id, id), isNull(tickets.deletedAt), inArray(tickets.status, from)))
			.returning();
		return row ?? null;
	}
}
