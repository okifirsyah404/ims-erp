import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { costCenters, type TCostCenterSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	ICostCenterRepository,
	TCostCenterPaginationRequest,
} from '../contracts/cost-center.repository.interface';

/** Drizzle implementation of {@link ICostCenterRepository} (ERP-0127). */
@injectable()
export class CostCenterRepository implements ICostCenterRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findById(organizationId: string, id: string, tx?: TTx): Promise<TCostCenterSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(costCenters)
			.where(
				and(
					eq(costCenters.id, id),
					eq(costCenters.organizationId, organizationId),
					isNull(costCenters.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findByCode(organizationId: string, code: string): Promise<TCostCenterSelect | null> {
		const [row] = await this.database
			.select()
			.from(costCenters)
			.where(
				and(
					eq(costCenters.code, code),
					eq(costCenters.organizationId, organizationId),
					isNull(costCenters.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async paginate(
		request: TCostCenterPaginationRequest,
	): Promise<TPaginationResult<TCostCenterSelect>> {
		const { organizationId, search, isActive, page, limit } = request;
		const conditions = [
			eq(costCenters.organizationId, organizationId),
			isNull(costCenters.deletedAt),
		];
		if (search) {
			const pattern = `%${search}%`;
			conditions.push(or(ilike(costCenters.code, pattern), ilike(costCenters.name, pattern))!);
		}
		if (isActive !== undefined) conditions.push(eq(costCenters.isActive, isActive));
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(costCenters)
			.where(where);
		const data = await this.database
			.select()
			.from(costCenters)
			.where(where)
			.orderBy(asc(costCenters.code))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async insert(row: {
		organizationId: string;
		code: string;
		name: string;
		parentCostCenterId: string | null;
		description: string | null;
	}): Promise<TCostCenterSelect> {
		const now = new Date();
		const [created] = await this.database
			.insert(costCenters)
			.values({ ...row, isActive: true, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async update(
		organizationId: string,
		id: string,
		patch: {
			name?: string;
			parentCostCenterId?: string | null;
			isActive?: boolean;
			description?: string | null;
		},
	): Promise<TCostCenterSelect | null> {
		const [updated] = await this.database
			.update(costCenters)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(costCenters.id, id),
					eq(costCenters.organizationId, organizationId),
					isNull(costCenters.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}
}
