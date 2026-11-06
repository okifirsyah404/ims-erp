import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { serviceTickets, type TServiceTicketSelect } from '@drizzle/schemas/aftersales.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IServiceTicketRepository, TTicketCreateData, TTicketListQuery } from '../contracts/service-ticket.contract';

/** Drizzle implementation of {@link IServiceTicketRepository}. */
@injectable()
export class ServiceTicketRepository implements IServiceTicketRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async paginate(query: TTicketListQuery & { assigneeUserId?: string }): Promise<TPaginationResult<TServiceTicketSelect>> {
		const { page, limit, search, status, assigneeUserId } = query;
		const where = and(
			isNull(serviceTickets.deletedAt),
			status ? eq(serviceTickets.status, status) : undefined,
			assigneeUserId ? eq(serviceTickets.assigneeUserId, assigneeUserId) : undefined,
			search
				? or(
						ilike(serviceTickets.code, likePattern(search)),
						ilike(serviceTickets.customerName, likePattern(search)),
						ilike(serviceTickets.serialNumber, likePattern(search)),
						ilike(serviceTickets.complaint, likePattern(search)),
					)
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(serviceTickets).where(where);
		const data = await this.database
			.select()
			.from(serviceTickets)
			.where(where)
			.orderBy(desc(serviceTickets.reportedAt), desc(serviceTickets.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string) {
		const [row] = await this.database
			.select()
			.from(serviceTickets)
			.where(and(eq(serviceTickets.id, id), isNull(serviceTickets.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: TTicketCreateData) {
		const now = new Date();
		const [row] = await this.database
			.insert(serviceTickets)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async transition(id: string, from: TServiceTicketSelect['status'][], data: Parameters<IServiceTicketRepository['transition']>[2]) {
		const [row] = await this.database
			.update(serviceTickets)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(serviceTickets.id, id), isNull(serviceTickets.deletedAt), inArray(serviceTickets.status, from)))
			.returning();
		return row ?? null;
	}
}
