import { DRIZZLE_TOKEN } from '@di/provider';
import {
	stockAdjustmentItems,
	stockAdjustments,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IAdjustmentRepository,
	TAdjustmentLineData,
	TAdjustmentPaginationRequest,
} from '../contracts/adjustment.repository.interface';
import type {
	TStockAdjustmentInsert,
	TStockAdjustmentItemSelect,
	TStockAdjustmentSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';

/**
 * Drizzle implementation of {@link IAdjustmentRepository}.
 *
 * @remarks
 * Reads exclude soft-deleted documents and lines. `replaceLines` soft-deletes
 * the previous lines rather than hard-deleting them: a draft's line history is
 * cheap to keep and hard deletion would lose the only record of what was
 * retyped before submission.
 */
@injectable()
export class AdjustmentRepository implements IAdjustmentRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/** Fetches one filtered page of adjustment documents. */
	async paginate(
		request: TAdjustmentPaginationRequest,
	): Promise<TPaginationResult<TStockAdjustmentSelect>> {
		const { page, limit, organizationId, warehouseId, status, adjustmentType, search } =
			request;

		const where = and(
			isNull(stockAdjustments.deletedAt),
			organizationId
				? eq(stockAdjustments.organizationId, organizationId)
				: undefined,
			warehouseId
				? eq(stockAdjustments.warehouseId, warehouseId)
				: undefined,
			status ? eq(stockAdjustments.status, status) : undefined,
			adjustmentType
				? eq(stockAdjustments.adjustmentType, adjustmentType)
				: undefined,
			search ? ilike(stockAdjustments.code, `%${search}%`) : undefined,
		);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(stockAdjustments)
			.where(where);

		const data = await this.database
			.select()
			.from(stockAdjustments)
			.where(where)
			.orderBy(
				desc(stockAdjustments.requestedAt),
				desc(stockAdjustments.id),
			)
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data);
	}

	/** Fetches one alive document by id. */
	async findById(id: string): Promise<TStockAdjustmentSelect | null> {
		const [row] = await this.database
			.select()
			.from(stockAdjustments)
			.where(
				and(
					eq(stockAdjustments.id, id),
					isNull(stockAdjustments.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Fetches one alive document by tenant + code. */
	async findByCode(
		organizationId: string,
		code: string,
	): Promise<TStockAdjustmentSelect | null> {
		const [row] = await this.database
			.select()
			.from(stockAdjustments)
			.where(
				and(
					eq(stockAdjustments.organizationId, organizationId),
					eq(stockAdjustments.code, code),
					isNull(stockAdjustments.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Inserts a document header. */
	async create(
		data: TStockAdjustmentInsert,
		tx?: TTx,
	): Promise<TStockAdjustmentSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(stockAdjustments).values(data).returning();
		return row;
	}

	/** Applies a partial update to an alive document. */
	async update(
		id: string,
		data: Partial<TStockAdjustmentInsert>,
		tx?: TTx,
	): Promise<TStockAdjustmentSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(stockAdjustments)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(stockAdjustments.id, id),
					isNull(stockAdjustments.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Atomically claims a document for posting.
	 *
	 * @remarks
	 * Conditional update: `WHERE status = 'approved' AND posted_at IS NULL`.
	 * Exactly one concurrent poster matches; every other gets `null`. The
	 * claim is written inside the caller's transaction, so a rollback
	 * (insufficient stock, serialization failure) automatically releases it —
	 * the document stays re-postable with no compensating update.
	 */
	async claimForPost(
		id: string,
		tx: TTx,
	): Promise<TStockAdjustmentSelect | null> {
		const [row] = await tx
			.update(stockAdjustments)
			.set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(stockAdjustments.id, id),
					isNull(stockAdjustments.deletedAt),
					eq(stockAdjustments.status, 'approved'),
					isNull(stockAdjustments.postedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/** Lists the alive lines of a document. */
	async listLines(
		adjustmentId: string,
	): Promise<TStockAdjustmentItemSelect[]> {
		return this.database
			.select()
			.from(stockAdjustmentItems)
			.where(
				and(
					eq(stockAdjustmentItems.stockAdjustmentId, adjustmentId),
					isNull(stockAdjustmentItems.deletedAt),
				),
			)
			.orderBy(asc(stockAdjustmentItems.createdAt), asc(stockAdjustmentItems.id));
	}

	/** Inserts many lines in one statement. */
	async createLines(
		lines: readonly TAdjustmentLineData[],
		tx?: TTx,
	): Promise<TStockAdjustmentItemSelect[]> {
		if (lines.length === 0) return [];
		const db = tx ?? this.database;
		const now = new Date();
		return db
			.insert(stockAdjustmentItems)
			.values(lines.map((line) => ({ createdAt: now, ...line })))
			.returning();
	}

	/**
	 * Replaces all lines of a document.
	 *
	 * @remarks
	 * Soft-deletes the old lines then inserts the new ones in one unit of work,
	 * so a failure cannot leave a draft with no lines at all. Uses the caller's
	 * transaction when given one, so a caller that also writes the header
	 * commits the whole document or none of it.
	 */
	async replaceLines(
		adjustmentId: string,
		lines: readonly TAdjustmentLineData[],
		tx?: TTx,
	): Promise<TStockAdjustmentItemSelect[]> {
		const run = async (db: TTx | BunSQLDatabase) => {
			const now = new Date();
			await db
				.update(stockAdjustmentItems)
				.set({ deletedAt: now, updatedAt: now })
				.where(
					and(
						eq(stockAdjustmentItems.stockAdjustmentId, adjustmentId),
						isNull(stockAdjustmentItems.deletedAt),
					),
				);
			if (lines.length === 0) return [];
			return db
				.insert(stockAdjustmentItems)
				.values(lines.map((line) => ({ createdAt: now, ...line })))
				.returning();
		};

		return tx
			? run(tx)
			: this.database.transaction(async (inner) => run(inner));
	}
}
