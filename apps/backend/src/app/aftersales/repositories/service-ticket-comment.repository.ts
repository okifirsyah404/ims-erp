import { DRIZZLE_TOKEN } from '@di/provider';
import { serviceTicketComments, type TServiceTicketCommentSelect } from '@drizzle/schemas/aftersales.schema';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IServiceTicketCommentRepository, TTicketCommentData } from '../contracts/service-ticket.contract';

/** Drizzle implementation of {@link IServiceTicketCommentRepository}. */
@injectable()
export class ServiceTicketCommentRepository implements IServiceTicketCommentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async list(ticketId: string, visibility?: 'customer') {
		return this.database
			.select()
			.from(serviceTicketComments)
			.where(
				and(
					eq(serviceTicketComments.serviceTicketId, ticketId),
					isNull(serviceTicketComments.deletedAt),
					visibility ? eq(serviceTicketComments.visibility, visibility) : undefined,
				),
			)
			.orderBy(asc(serviceTicketComments.createdAt), asc(serviceTicketComments.id));
	}

	async latestCustomerVisible(ticketIds: string[]) {
		const result = new Map<string, { latest: TServiceTicketCommentSelect; count: number }>();
		if (ticketIds.length === 0) return result;
		const rows = await this.database
			.select()
			.from(serviceTicketComments)
			.where(
				and(
					inArray(serviceTicketComments.serviceTicketId, ticketIds),
					isNull(serviceTicketComments.deletedAt),
					eq(serviceTicketComments.visibility, 'customer'),
				),
			)
			.orderBy(asc(serviceTicketComments.createdAt), asc(serviceTicketComments.id));
		for (const row of rows) {
			const entry = result.get(row.serviceTicketId);
			result.set(row.serviceTicketId, { latest: row, count: (entry?.count ?? 0) + 1 });
		}
		return result;
	}

	async create(data: TTicketCommentData) {
		const now = new Date();
		const [row] = await this.database
			.insert(serviceTicketComments)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}
}
