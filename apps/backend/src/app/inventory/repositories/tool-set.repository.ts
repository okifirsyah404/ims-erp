import { DRIZZLE_TOKEN } from '@di/provider';
import {
	toolSetItems,
	toolSets,
	type ToolSetStatus,
	type TToolSetInsert,
	type TToolSetItemInsert,
	type TToolSetItemSelect,
	type TToolSetSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	IToolSetItemRepository,
	IToolSetRepository,
	TToolSetPaginationRequest,
} from '../contracts/item-operations.repository.interface';

/** Drizzle implementation of {@link IToolSetRepository} on `inventory.tool_sets`. */
@injectable()
export class ToolSetRepository implements IToolSetRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findById(id: string): Promise<TToolSetSelect | null> {
		const [row] = await this.database
			.select()
			.from(toolSets)
			.where(and(eq(toolSets.id, id), isNull(toolSets.deletedAt)));
		return row ?? null;
	}

	async create(data: TToolSetInsert, tx?: TTx): Promise<TToolSetSelect> {
		const [row] = await (tx ?? this.database).insert(toolSets).values(data).returning();
		return row;
	}

	/**
	 * Fetches one page of the tenant's tool sets, ordered by code.
	 *
	 * @param request - Tenant and page settings
	 */
	async paginate(
		request: TToolSetPaginationRequest,
	): Promise<TPaginationResult<TToolSetSelect>> {
		const { organizationId, page, limit } = request;
		const where = and(eq(toolSets.organizationId, organizationId), isNull(toolSets.deletedAt));
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(toolSets)
			.where(where);
		const data = await this.database
			.select()
			.from(toolSets)
			.where(where)
			.orderBy(asc(toolSets.code))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async update(id: string, data: Partial<TToolSetInsert>, tx?: TTx): Promise<TToolSetSelect | null> {
		const [row] = await (tx ?? this.database)
			.update(toolSets)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(toolSets.id, id), isNull(toolSets.deletedAt)))
			.returning();
		return row ?? null;
	}

	setStatus(id: string, status: ToolSetStatus, tx?: TTx): Promise<TToolSetSelect | null> {
		return this.update(id, { status }, tx);
	}

	async archive(id: string, tx?: TTx): Promise<TToolSetSelect | null> {
		const now = new Date();
		const [row] = await (tx ?? this.database)
			.update(toolSets)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(toolSets.id, id), isNull(toolSets.deletedAt)))
			.returning();
		return row ?? null;
	}
}

/** Drizzle implementation of {@link IToolSetItemRepository} on `inventory.tool_set_items`. */
@injectable()
export class ToolSetItemRepository implements IToolSetItemRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByToolSet(toolSetId: string): Promise<TToolSetItemSelect[]> {
		return this.database
			.select()
			.from(toolSetItems)
			.where(and(eq(toolSetItems.toolSetId, toolSetId), isNull(toolSetItems.deletedAt)))
			.orderBy(asc(toolSetItems.createdAt));
	}

	async listItemIds(toolSetId: string): Promise<string[]> {
		return (await this.listByToolSet(toolSetId)).map((row) => row.itemId);
	}

	async add(data: TToolSetItemInsert, tx?: TTx): Promise<TToolSetItemSelect> {
		const [row] = await (tx ?? this.database).insert(toolSetItems).values(data).returning();
		return row;
	}

	async remove(toolSetId: string, rowId: string, tx?: TTx): Promise<boolean> {
		const now = new Date();
		const rows = await (tx ?? this.database)
			.update(toolSetItems)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(toolSetItems.id, rowId),
					eq(toolSetItems.toolSetId, toolSetId),
					isNull(toolSetItems.deletedAt),
				),
			)
			.returning();
		return rows.length > 0;
	}
}
