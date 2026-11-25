import { DRIZZLE_TOKEN } from '@di/provider';
import { apOpenItems, arOpenItems, cashForecastLines, type TCashForecastLineSelect } from '@drizzle/schemas/finance.schema';
import { and, asc, eq, gt, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ICashForecastRepository } from '../contracts/cash-forecast.contract';

/** Drizzle implementation of {@link ICashForecastRepository} (ERP-0149). */
@injectable()
export class CashForecastRepository implements ICashForecastRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	openReceivables(organizationId: string) {
		return this.database
			.select({ dueDate: arOpenItems.dueDate, outstanding: arOpenItems.outstandingAmount })
			.from(arOpenItems)
			.where(and(eq(arOpenItems.organizationId, organizationId), inArray(arOpenItems.status, ['open', 'partially_paid']), gt(arOpenItems.outstandingAmount, 0)));
	}

	openPayables(organizationId: string) {
		return this.database
			.select({ dueDate: apOpenItems.dueDate, outstanding: apOpenItems.outstandingAmount })
			.from(apOpenItems)
			.where(and(eq(apOpenItems.organizationId, organizationId), inArray(apOpenItems.status, ['open', 'partially_paid']), gt(apOpenItems.outstandingAmount, 0)));
	}

	listLines(organizationId: string, from: string, to: string) {
		return this.database
			.select()
			.from(cashForecastLines)
			.where(
				and(
					eq(cashForecastLines.organizationId, organizationId),
					isNull(cashForecastLines.deletedAt),
					gte(cashForecastLines.expectedDate, from),
					lte(cashForecastLines.expectedDate, to),
				),
			)
			.orderBy(asc(cashForecastLines.expectedDate));
	}

	async insertLine(row: Parameters<ICashForecastRepository['insertLine']>[0]) {
		const now = new Date();
		const [created] = await this.database.insert(cashForecastLines).values({ ...row, createdAt: now, updatedAt: now }).returning();
		return created as TCashForecastLineSelect;
	}

	async removeLine(organizationId: string, id: string) {
		const now = new Date();
		const removed = await this.database
			.update(cashForecastLines)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(cashForecastLines.organizationId, organizationId), eq(cashForecastLines.id, id), isNull(cashForecastLines.deletedAt)))
			.returning({ id: cashForecastLines.id });
		return removed.length > 0;
	}
}
