import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	deferredRevenueSchedules,
	type TDeferredRevenueScheduleInsert,
	type TDeferredRevenueScheduleSelect,
} from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	IDeferredRevenueRepository,
	TDeferredRevenuePaginationRequest,
} from '../contracts/deferred-revenue.repository.interface';


@injectable()
export class DeferredRevenueRepository implements IDeferredRevenueRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertMany(
		rows: Array<Omit<TDeferredRevenueScheduleInsert, 'createdAt' | 'updatedAt'>>,
		tx: TTx,
	): Promise<void> {
		if (rows.length === 0) return;
		const now = new Date();
		await tx.insert(deferredRevenueSchedules).values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })));
	}

	private dueWhere(organizationId: string, month: string, monthEndDate: string) {
		return and(
			eq(deferredRevenueSchedules.organizationId, organizationId),
			eq(deferredRevenueSchedules.status, 'active'),
			isNull(deferredRevenueSchedules.deletedAt),
			lte(deferredRevenueSchedules.startDate, monthEndDate),
			or(
				isNull(deferredRevenueSchedules.recognizedThrough),
				sql`${deferredRevenueSchedules.recognizedThrough} < ${month}`,
			),
		);
	}

	async listDue(organizationId: string, month: string, monthEndDate: string): Promise<TDeferredRevenueScheduleSelect[]> {
		return this.database
			.select()
			.from(deferredRevenueSchedules)
			.where(this.dueWhere(organizationId, month, monthEndDate))
			.orderBy(asc(deferredRevenueSchedules.startDate));
	}

	async findById(organizationId: string, id: string, tx?: TTx): Promise<TDeferredRevenueScheduleSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(deferredRevenueSchedules)
			.where(
				and(
					eq(deferredRevenueSchedules.id, id),
					eq(deferredRevenueSchedules.organizationId, organizationId),
					isNull(deferredRevenueSchedules.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async listByInvoice(organizationId: string, invoiceId: string, tx: TTx): Promise<TDeferredRevenueScheduleSelect[]> {
		return tx
			.select()
			.from(deferredRevenueSchedules)
			.where(
				and(
					eq(deferredRevenueSchedules.organizationId, organizationId),
					eq(deferredRevenueSchedules.invoiceId, invoiceId),
					isNull(deferredRevenueSchedules.deletedAt),
				),
			);
	}

	async update(
		organizationId: string,
		id: string,
		patch: Partial<Pick<TDeferredRevenueScheduleSelect, 'recognizedAmount' | 'recognizedThrough' | 'status'>>,
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		await db
			.update(deferredRevenueSchedules)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(eq(deferredRevenueSchedules.id, id), eq(deferredRevenueSchedules.organizationId, organizationId)),
			);
	}

	async paginate(
		request: TDeferredRevenuePaginationRequest,
	): Promise<TPaginationResult<TDeferredRevenueScheduleSelect>> {
		const conditions = [
			eq(deferredRevenueSchedules.organizationId, request.organizationId),
			isNull(deferredRevenueSchedules.deletedAt),
		];
		if (request.status) conditions.push(eq(deferredRevenueSchedules.status, request.status));
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(deferredRevenueSchedules)
			.where(where);
		const data = await this.database
			.select()
			.from(deferredRevenueSchedules)
			.where(where)
			.orderBy(desc(deferredRevenueSchedules.startDate))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		return paginationResult(request, total, data);
	}

	async countPending(organizationId: string, month: string, monthEndDate: string): Promise<number> {
		const [row] = await this.database
			.select({ value: count() })
			.from(deferredRevenueSchedules)
			.where(this.dueWhere(organizationId, month, monthEndDate));
		return row.value;
	}
}
