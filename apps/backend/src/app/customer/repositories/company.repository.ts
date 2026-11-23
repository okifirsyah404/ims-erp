import { CACHE_CLIENT_TOKEN, DRIZZLE_TOKEN } from '@di/provider';
import {
	customerCompanies,
	type TCustomerCompanyInsert,
	type TCustomerCompanySelect,
} from '@drizzle/schemas/customer.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { cacheIdKey } from '@utils/cache.util';
import { paginationResult } from '@utils/pagination.util';
import type { ICacheClient } from '@cache/cache.client';
import type {
	ICompanyRepository,
	TCompanyPaginationRequest,
	TNewCompany,
} from '../contracts/customer.repository.interface';

/**
 * Drizzle + Redis implementation of {@link ICompanyRepository}.
 *
 * @remarks
 * `findById` and `findByCode` use cache-aside with negative caching; every
 * write evicts both entries. `paginate` is never cached.
 */
@injectable()
export class CompanyRepository implements ICompanyRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: ICacheClient,
	) {}

	private readonly cachePrefix = 'customer:company';

	private live(id: string) {
		return and(
			eq(customerCompanies.id, id),
			isNull(customerCompanies.deletedAt),
		);
	}

	private filters(query: TCompanyPaginationRequest) {
		return and(
			isNull(customerCompanies.deletedAt),
			query.status
				? eq(customerCompanies.status, query.status)
				: undefined,
			query.companyType
				? eq(customerCompanies.companyType, query.companyType)
				: undefined,
			query.search
				? or(
						ilike(customerCompanies.name, likePattern(query.search)),
						ilike(customerCompanies.code, likePattern(query.search)),
					)
				: undefined,
		);
	}

	private ordering(query: TCompanyPaginationRequest) {
		const column = {
			code: customerCompanies.code,
			name: customerCompanies.name,
			status: customerCompanies.status,
			createdAt: customerCompanies.createdAt,
		}[query.sort ?? 'name'];
		const direction = query.order === 'desc' ? desc : asc;
		return [direction(column), direction(customerCompanies.id)];
	}

	/** Fetches one filtered page of customer companies in the requested order. */
	async paginate(
		request: TCompanyPaginationRequest,
	): Promise<TPaginationResult<TCustomerCompanySelect>> {
		const where = this.filters(request);
		const rows = await this.database
			.select()
			.from(customerCompanies)
			.where(where)
			.orderBy(...this.ordering(request))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(customerCompanies)
			.where(where);
		return paginationResult(request, Number(total), rows);
	}

	async findById(id: string): Promise<TCustomerCompanySelect | null> {
		return this.cache.remember(
			cacheIdKey(this.cachePrefix, id),
			async () => {
				const [row] = await this.database
					.select()
					.from(customerCompanies)
					.where(this.live(id))
					.limit(1);
				return row ?? null;
			},
		);
	}

	async findByCode(code: string): Promise<TCustomerCompanySelect | null> {
		return this.cache.remember(
			`${this.cachePrefix}:code:${code}`,
			async () => {
				const [row] = await this.database
					.select()
					.from(customerCompanies)
					.where(
						and(
							eq(customerCompanies.code, code),
							isNull(customerCompanies.deletedAt),
						),
					)
					.limit(1);
				return row ?? null;
			},
		);
	}

	async create(data: TNewCompany): Promise<TCustomerCompanySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(customerCompanies)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		await this.invalidate(row);
		return row;
	}

	async update(
		id: string,
		patch: Partial<TCustomerCompanyInsert>,
	): Promise<TCustomerCompanySelect | null> {
		const [row] = await this.database
			.update(customerCompanies)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	async softDelete(id: string): Promise<void> {
		const [row] = await this.database
			.update(customerCompanies)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		if (row) await this.invalidate(row);
	}

	async transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	): Promise<TCustomerCompanySelect | null> {
		const [row] = await this.database
			.update(customerCompanies)
			.set({ status: to, updatedAt: new Date() })
			.where(and(this.live(id), eq(customerCompanies.status, from)))
			.returning();
		if (row) await this.invalidate(row);
		return row ?? null;
	}

	private async invalidate(row: TCustomerCompanySelect): Promise<void> {
		await this.cache.del(
			cacheIdKey(this.cachePrefix, row.id),
			`${this.cachePrefix}:code:${row.code}`,
		);
	}
}
