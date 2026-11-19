import { DRIZZLE_TOKEN } from '@di/provider';
import {
	disposals,
	type TDisposalInsert,
	type TDisposalSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IDisposalRepository } from '../contracts/item-operations.repository.interface';

/** Drizzle implementation of {@link IDisposalRepository} on `inventory.disposals`. */
@injectable()
export class DisposalRepository implements IDisposalRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async create(data: TDisposalInsert, tx?: TTx): Promise<TDisposalSelect> {
		const [row] = await (tx ?? this.database).insert(disposals).values(data).returning();
		return row;
	}

	async findById(id: string): Promise<TDisposalSelect | null> {
		const [row] = await this.database
			.select()
			.from(disposals)
			.where(and(eq(disposals.id, id), isNull(disposals.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async list(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TDisposalSelect>> {
		const where = and(eq(disposals.organizationId, organizationId), isNull(disposals.deletedAt));
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(disposals)
			.where(where);
		const data = await this.database
			.select()
			.from(disposals)
			.where(where)
			.orderBy(desc(disposals.createdAt), desc(disposals.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async update(
		id: string,
		data: Partial<TDisposalInsert>,
		tx?: TTx,
	): Promise<TDisposalSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(disposals)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(disposals.id, id), isNull(disposals.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** The `status = 'approved'` predicate is the concurrency guard: of two executions, one matches. */
	async claimForExecution(
		id: string,
		snapshot: { bookValueAtDisposal: number; gainLoss: number },
		tx: TTx,
	): Promise<TDisposalSelect | null> {
		const now = new Date();
		const [row] = await tx
			.update(disposals)
			.set({ status: 'executed', executedAt: now, updatedAt: now, ...snapshot })
			.where(
				and(
					eq(disposals.id, id),
					eq(disposals.status, 'approved'),
					isNull(disposals.executedAt),
					isNull(disposals.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}
}
