import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	supplierCompanies,
	type TSupplierCompanySelect,
} from '@drizzle/schemas/supplier.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey } from '@utils/cache.util';
import { paginationResult } from '@utils/pagination.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	TSupplierCompanyCreateInput,
	TSupplierCompanyUpdateInput,
} from '../contracts/supplier.contract';
import type {
	ISupplierCompanyRepository,
	TSupplierCompanyPaginationRequest,
} from '../contracts/supplier.repository.interface';

/**
 * Drizzle + Redis implementation of {@link ISupplierCompanyRepository}.
 *
 * @remarks
 * `findById` and `findByCode` use cache-aside with negative caching; writes
 * evict both entries. `paginate` is never cached.
 */
@injectable()
export class SupplierCompanyRepository implements ISupplierCompanyRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	private readonly cachePrefix = 'supplier:company';

	private live(id: string) {
		return and(
			eq(supplierCompanies.id, id),
			isNull(supplierCompanies.deletedAt),
		);
	}

	private filters(query: TSupplierCompanyPaginationRequest) {
		return and(
			isNull(supplierCompanies.deletedAt),
			query.status ? eq(supplierCompanies.status, query.status) : undefined,
			query.search
				? or(
						ilike(
							supplierCompanies.name,
							likePattern(query.search),
						),
						ilike(
							supplierCompanies.code,
							likePattern(query.search),
						),
					)
				: undefined,
		);
	}

	/** Fetches one filtered page of supplier companies, ordered by name. */
	async paginate(
		request: TSupplierCompanyPaginationRequest,
	): Promise<TPaginationResult<TSupplierCompanySelect>> {
		const where = this.filters(request);
		const rows = await this.database
			.select()
			.from(supplierCompanies)
			.where(where)
			.orderBy(asc(supplierCompanies.name), asc(supplierCompanies.id))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(supplierCompanies)
			.where(where);
		return paginationResult(request, Number(total), rows);
	}

	async findById(id: string): Promise<TSupplierCompanySelect | null> {
		return this.cache.remember(
			cacheIdKey(this.cachePrefix, id),
			async () => {
				const [row] = await this.database
					.select()
					.from(supplierCompanies)
					.where(this.live(id))
					.limit(1);
				return row ?? null;
			},
		);
	}

	async findByCode(code: string): Promise<TSupplierCompanySelect | null> {
		return this.cache.remember(
			`${this.cachePrefix}:code:${code}`,
			async () => {
				const [row] = await this.database
					.select()
					.from(supplierCompanies)
					.where(
						and(
							eq(supplierCompanies.code, code),
							isNull(supplierCompanies.deletedAt),
						),
					)
					.limit(1);
				return row ?? null;
			},
		);
	}

	async create(
		data: TSupplierCompanyCreateInput & { code: string; createdBy: string },
	): Promise<TSupplierCompanySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(supplierCompanies)
			.values({ ...data, status: 'active', createdAt: now, updatedAt: now })
			.returning();
		await this.invalidate(row);
		return row;
	}

	async update(
		id: string,
		patch: TSupplierCompanyUpdateInput,
	): Promise<TSupplierCompanySelect | null> {
		const [row] = await this.database
			.update(supplierCompanies)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	async transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	): Promise<TSupplierCompanySelect | null> {
		const [row] = await this.database
			.update(supplierCompanies)
			.set({ status: to, updatedAt: new Date() })
			.where(and(this.live(id), eq(supplierCompanies.status, from)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	private async invalidate(row: TSupplierCompanySelect): Promise<void> {
		await this.cache.del(
			cacheIdKey(this.cachePrefix, row.id),
			`${this.cachePrefix}:code:${row.code}`,
		);
	}
}
