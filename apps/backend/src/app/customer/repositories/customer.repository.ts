import { DRIZZLE_TOKEN } from '@di/provider';
import {
	customers,
	type PortalRole,
	type TCustomerInsert,
	type TCustomerSelect,
} from '@drizzle/schemas/customer.schema';
import { likePattern } from '@drizzle/search';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, ilike, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	ICustomerPersonRepository,
	TCustomerPaginationRequest,
	TNewCustomer,
} from '../contracts/customer.repository.interface';

/**
 * Drizzle implementation of {@link ICustomerPersonRepository}.
 *
 * @remarks
 * Reads are never cached: people are listed through their company and the
 * set is small. "Primary" is kept single per company by clearing the previous
 * primary before the write.
 */
@injectable()
export class CustomerPersonRepository implements ICustomerPersonRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private live(id: string) {
		return and(eq(customers.id, id), isNull(customers.deletedAt));
	}

	private filters(query: TCustomerPaginationRequest) {
		return and(
			isNull(customers.deletedAt),
			query.status ? eq(customers.status, query.status) : undefined,
			query.customerType ? eq(customers.customerType, query.customerType) : undefined,
			query.companyId ? eq(customers.companyId, query.companyId) : undefined,
			query.search
				? or(
						ilike(customers.name, likePattern(query.search)),
						ilike(customers.code, likePattern(query.search)),
					)
				: undefined,
		);
	}

	/** Fetches one filtered page of customer people, ordered by name. */
	async paginate(
		request: TCustomerPaginationRequest,
	): Promise<TPaginationResult<TCustomerSelect>> {
		const where = this.filters(request);
		const rows = await this.database
			.select()
			.from(customers)
			.where(where)
			.orderBy(asc(customers.name), asc(customers.id))
			.limit(request.limit)
			.offset((request.page - 1) * request.limit);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(customers)
			.where(where);
		return paginationResult(request, Number(total), rows);
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

	async findByUserId(userId: string): Promise<TCustomerSelect | null> {
		const [row] = await this.database
			.select()
			.from(customers)
			.where(and(eq(customers.userId, userId), isNull(customers.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: TNewCustomer): Promise<TCustomerSelect> {
		const now = new Date();
		if (data.isPrimary && data.companyId) {
			await this.clearPrimary(data.companyId);
		}
		const [row] = await this.database
			.insert(customers)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async update(id: string, patch: Partial<TCustomerInsert>): Promise<TCustomerSelect | null> {
		if (patch.isPrimary) {
			const [current] = await this.database
				.select({ companyId: customers.companyId })
				.from(customers)
				.where(this.live(id))
				.limit(1);
			if (current?.companyId) await this.clearPrimary(current.companyId);
		}
		const [row] = await this.database
			.update(customers)
			.set({ ...patch, updatedAt: new Date() })
			.where(this.live(id))
			.returning();
		return row ?? null;
	}

	async listPortalAccounts(scope: {
		customerId: string;
		companyId: string | null;
	}): Promise<TCustomerSelect[]> {
		return this.database
			.select()
			.from(customers)
			.where(
				and(
					isNull(customers.deletedAt),
					isNotNull(customers.userId),
					ne(customers.portalStatus, 'revoked'),
					scope.companyId
						? eq(customers.companyId, scope.companyId)
						: eq(customers.id, scope.customerId),
				),
			)
			.orderBy(asc(customers.createdAt), asc(customers.id));
	}

	async grantPortalAccess(
		id: string,
		data: { userId: string; portalRole: PortalRole; portalInvitedBy: string | null },
	): Promise<TCustomerSelect | null> {
		const [row] = await this.database
			.update(customers)
			.set({
				userId: data.userId,
				portalRole: data.portalRole,
				portalStatus: 'active',
				portalInvitedBy: data.portalInvitedBy,
				updatedAt: new Date(),
			})
			.where(this.live(id))
			.returning();
		return row ?? null;
	}

	async revokePortalAccess(id: string): Promise<TCustomerSelect | null> {
		const active = and(
			this.live(id),
			isNotNull(customers.userId),
			or(isNull(customers.portalStatus), ne(customers.portalStatus, 'revoked')),
		);
		const [before] = await this.database.select().from(customers).where(active).limit(1);
		if (!before) return null;
		const updated = await this.database
			.update(customers)
			.set({ portalStatus: 'revoked', userId: null, updatedAt: new Date() })
			.where(active)
			.returning({ id: customers.id });
		return updated.length > 0 ? before : null;
	}

	async touchPortalLogin(id: string): Promise<void> {
		await this.database
			.update(customers)
			.set({ portalLastLoginAt: new Date() })
			.where(eq(customers.id, id));
	}

	async clearPrimary(companyId: string): Promise<void> {
		await this.database
			.update(customers)
			.set({ isPrimary: false, updatedAt: new Date() })
			.where(
				and(
					eq(customers.companyId, companyId),
					eq(customers.isPrimary, true),
					isNull(customers.deletedAt),
				),
			);
	}

	async transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	): Promise<TCustomerSelect | null> {
		const [row] = await this.database
			.update(customers)
			.set({ status: to, updatedAt: new Date() })
			.where(and(this.live(id), eq(customers.status, from)))
			.returning();
		return row ?? null;
	}
}
