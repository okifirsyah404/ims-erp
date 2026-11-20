import { DRIZZLE_TOKEN } from '@di/provider';
import {
	assetDepreciations,
	type TAssetDepreciationInsert,
	type TAssetDepreciationSelect,
} from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	IDepreciationRepository,
	TDepreciationPaginationRequest,
} from '../contracts/depreciation.repository.interface';

/** Drizzle queries of `finance.asset_depreciations`. */
@injectable()
export class DepreciationRepository implements IDepreciationRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findPeriod(
		itemId: string,
		periodYear: number,
		periodMonth: number,
		tx?: TTx,
	): Promise<TAssetDepreciationSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(assetDepreciations)
			.where(
				and(
					eq(assetDepreciations.itemId, itemId),
					eq(assetDepreciations.periodYear, periodYear),
					eq(assetDepreciations.periodMonth, periodMonth),
					isNull(assetDepreciations.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async create(
		data: Omit<TAssetDepreciationInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
		tx?: TTx,
	): Promise<TAssetDepreciationSelect> {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.insert(assetDepreciations)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row!;
	}

	/**
	 * Fetches one page of depreciation entries, newest period first.
	 *
	 * @param request - Tenant, page settings and the optional item filter
	 */
	async paginate(
		request: TDepreciationPaginationRequest,
	): Promise<TPaginationResult<TAssetDepreciationSelect>> {
		const { organizationId, itemId, page, limit } = request;
		const where = and(
			isNull(assetDepreciations.deletedAt),
			eq(assetDepreciations.organizationId, organizationId),
			itemId ? eq(assetDepreciations.itemId, itemId) : undefined,
		);
		const [rows, [total]] = await Promise.all([
			this.database
				.select()
				.from(assetDepreciations)
				.where(where)
				.orderBy(desc(assetDepreciations.periodYear), desc(assetDepreciations.periodMonth))
				.limit(limit)
				.offset((page - 1) * limit),
			this.database.select({ value: count() }).from(assetDepreciations).where(where),
		]);
		return paginationResult(request, Number(total?.value ?? 0), rows);
	}
}
