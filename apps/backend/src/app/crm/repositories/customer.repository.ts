import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type CustomerStatus,
	customers,
	type TCustomerSelect,
} from '@drizzle/schemas/crm.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	TCreateCustomerInput,
	TCustomerListQuery,
	TUpdateCustomerInput,
} from '../contracts/customer.contract';
import type { ICustomerRepository } from '../contracts/customer.repository.interface';

/** Drizzle implementation of {@link ICustomerRepository}. */
@injectable()
export class CustomerRepository implements ICustomerRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(customers.id, id), isNull(customers.deletedAt));
	}

	async paginate(query: TCustomerListQuery): Promise<TPaginationResult<TCustomerSelect>> {
		const { page, limit, search, status, customerType } = query;
		const where = and(
			isNull(customers.deletedAt),
			status ? eq(customers.status, status) : undefined,
			customerType ? eq(customers.customerType, customerType) : undefined,
			search
				? or(ilike(customers.name, likePattern(search)), ilike(customers.code, likePattern(search)))
				: undefined,
		);
		const [{ value: total }] = await this.database.select({ value: count() }).from(customers).where(where);
		const data = await this.database
			.select()
			.from(customers)
			.where(where)
			.orderBy(asc(customers.name), asc(customers.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findById(id: string): Promise<TCustomerSelect | null> {
		const [row] = await this.database.select().from(customers).where(this.live(id)).limit(1);
		return row ?? null;
	}

	async findByCode(code: string): Promise<TCustomerSelect | null> {
		const [row] = await this.database
			.select()
			.from(customers)
			.where(and(eq(customers.code, code), isNull(customers.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: TCreateCustomerInput & { createdBy: string }): Promise<TCustomerSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(customers)
			.values({ ...data, ownerUserId: data.createdBy, status: 'active', createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, patch: TUpdateCustomerInput): Promise<TCustomerSelect | null> {
		// The contract is `.strict()`, so `patch` only carries editable columns.
		const [row] = await this.database
			.update(customers)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		return row ?? null;
	}

	async transitionStatus(
		id: string,
		from: CustomerStatus,
		to: CustomerStatus,
	): Promise<TCustomerSelect | null> {
		const [row] = await this.database
			.update(customers)
			.set({ status: to, updatedAt: new Date() })
			.where(and(this.live(id), eq(customers.status, from)))
			.returning();
		return row ?? null;
	}
}
