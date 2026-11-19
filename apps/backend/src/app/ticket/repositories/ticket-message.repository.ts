import { DRIZZLE_TOKEN } from '@di/provider';
import { ticketMessages, type TTicketMessageSelect } from '@drizzle/schemas/ticket.schema';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ITicketMessageRepository, TTicketMessageData } from '../contracts/ticket.contract';

/** Drizzle implementation of {@link ITicketMessageRepository}. */
@injectable()
export class TicketMessageRepository implements ITicketMessageRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async list(ticketId: string, visibility?: 'customer') {
		return this.database
			.select()
			.from(ticketMessages)
			.where(
				and(
					eq(ticketMessages.ticketId, ticketId),
					isNull(ticketMessages.deletedAt),
					visibility ? eq(ticketMessages.visibility, visibility) : undefined,
				),
			)
			.orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id));
	}

	async latestCustomerVisible(ticketIds: string[]) {
		const result = new Map<string, { latest: TTicketMessageSelect; count: number }>();
		if (ticketIds.length === 0) return result;
		const rows = await this.database
			.select()
			.from(ticketMessages)
			.where(
				and(
					inArray(ticketMessages.ticketId, ticketIds),
					isNull(ticketMessages.deletedAt),
					eq(ticketMessages.visibility, 'customer'),
				),
			)
			.orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id));
		for (const row of rows) {
			const entry = result.get(row.ticketId);
			result.set(row.ticketId, { latest: row, count: (entry?.count ?? 0) + 1 });
		}
		return result;
	}

	async create(data: TTicketMessageData) {
		const now = new Date();
		const [row] = await this.database
			.insert(ticketMessages)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}
}
