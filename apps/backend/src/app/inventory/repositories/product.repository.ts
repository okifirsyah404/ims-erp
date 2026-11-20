import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type TProductSelect,
	products,
	itemSerials,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IProductRepository,
	TProductCreateData,
	TProductListRow,
	TProductPaginationRequest,
	TProductUpdateData,
} from '../contracts/product.repository.interface';

/**
 * Drizzle implementation of {@link IProductRepository}.
 *
 * @remarks
 * Uncached on purpose: item lists are filtered and small, and the inventory
 * flows that read products (stock movements, borrowing) need a read-your-writes
 * guarantee that a cache-aside layer would complicate.
 *
 * @see {@link import('@drizzle/schemas/inventory.schema').products} for the
 * nullable-`organization_id` and partial-unique-pair rules this respects.
 */
@injectable()
export class ProductRepository implements IProductRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/**
	 * Fetches one filtered page of products.
	 *
	 * @param request - Page settings plus optional filters
	 */
	async paginate(
		request: TProductPaginationRequest,
	): Promise<TPaginationResult<TProductListRow>> {
		const {
			page,
			limit,
			search,
			productKind,
			productCategoryId,
			activeOnly,
			warehouseId,
			includeArchived,
		} = request;

		const filters = [
			includeArchived ? undefined : isNull(products.deletedAt),
			productKind ? eq(products.productKind, productKind) : undefined,
			productCategoryId ? eq(products.productCategoryId, productCategoryId) : undefined,
			activeOnly ? eq(products.isActive, true) : undefined,
			// "Has a physical presence in this warehouse": either a live
			// serialized unit or a stock balance. Two EXISTS keep the row
			// multiplicity of the outer query intact (a join would duplicate
			// products that have several units/bins here).
			warehouseId
				? sql`(
						EXISTS (
							SELECT 1 FROM ${itemSerials}
							WHERE ${itemSerials.productId} = ${products.id}
								AND ${itemSerials.warehouseId} = ${warehouseId}
								AND ${itemSerials.deletedAt} IS NULL
						)
						OR EXISTS (
							SELECT 1 FROM inventory.stocks sb
							WHERE sb.product_id = ${products.id}
								AND sb.warehouse_id = ${warehouseId}
						)
					)`
				: undefined,
			search
				? or(
						ilike(products.sku, `%${search}%`),
						ilike(products.name, `%${search}%`),
						ilike(products.brand, `%${search}%`),
					)
				: undefined,
		].filter(Boolean);

		const where = filters.length > 0 ? and(...filters) : undefined;

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(products)
			.where(where);

		const data = await this.database
			// The warehouse-scoped quantity is a scalar subquery, not a join: a
			// join to `stocks` would duplicate products that hold stock in
			// several bins, breaking both row multiplicity and LIMIT/OFFSET.
			// Without a warehouse filter the column is simply NULL.
			.select({
				...getTableColumns(products),
				quantityOnHand:
					warehouseId !== undefined
						? sql<
								string
							>`COALESCE((SELECT SUM(sb.quantity_on_hand)
									FROM inventory.stocks sb
									WHERE sb.warehouse_id = ${warehouseId}
										AND sb.product_id = ${sql.raw('"inventory"."products"."id"')}), 0)::text`
						: sql<string | null>`NULL`,
			})
			.from(products)
			.where(where)
			.orderBy(asc(products.name))
			.limit(limit)
			.offset((page - 1) * limit);

		return paginationResult({ page, limit }, total, data);
	}

	/** Fetches one alive item by id. */
	async findActiveByIds(ids: string[]): Promise<TProductSelect[]> {
		if (ids.length === 0) return [];
		return this.database
			.select()
			.from(products)
			.where(and(inArray(products.id, ids), eq(products.isActive, true), isNull(products.deletedAt)));
	}

	async findById(id: string): Promise<TProductSelect | null> {
		const [row] = await this.database
			.select()
			.from(products)
			.where(and(eq(products.id, id), isNull(products.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Fetches one alive item by tenant + SKU.
	 *
	 * @remarks
	 * `organizationId === null` matches global rows only — `isNull`, never
	 * "any organization".
	 */
	async findBySku(
		organizationId: string | null,
		sku: string,
	): Promise<TProductSelect | null> {
		const [row] = await this.database
			.select()
			.from(products)
			.where(
				and(
					isNull(products.deletedAt),
					eq(products.sku, sku),
					organizationId === null
						? isNull(products.organizationId)
						: eq(products.organizationId, organizationId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Inserts an item. */
	async create(data: TProductCreateData, code: string): Promise<TProductSelect> {
		const [row] = await this.database
			.insert(products)
			.values({
				...data,
				code,
				createdAt: data.createdAt ?? new Date(),
			} as never)
			.returning();
		return row;
	}

	/**
	 * Applies a partial update to an alive item.
	 *
	 * @remarks
	 * `updatedAt` is refreshed explicitly: `$onUpdate` fires on the query
	 * builder path, not when the row is set through this object form.
	 */
	async update(
		id: string,
		data: TProductUpdateData,
	): Promise<TProductSelect | null> {
		if (Object.keys(data).length === 0) return this.findById(id);
		const [row] = await this.database
			.update(products)
			.set({ ...data, updatedAt: new Date() } as never)
			.where(and(eq(products.id, id), isNull(products.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** Soft-deletes an alive item. */
	async archive(id: string): Promise<TProductSelect | null> {
		const [row] = await this.database
			.update(products)
			.set({ deletedAt: new Date() })
			.where(and(eq(products.id, id), isNull(products.deletedAt)))
			.returning();
		return row ?? null;
	}

	/** @inheritdoc */
	async findNamesByIds(
		ids: string[],
	): Promise<Array<{ id: string; name: string; imageObjectKey: string | null }>> {
		if (ids.length === 0) return [];
		return this.database
			.select({ id: products.id, name: products.name, imageObjectKey: products.imageObjectKey })
			.from(products)
			.where(and(inArray(products.id, ids), isNull(products.deletedAt)));
	}

	/** @inheritdoc */
	listListed(): Promise<TProductSelect[]> {
		return this.database
			.select()
			.from(products)
			.where(and(isNull(products.deletedAt), isNotNull(products.slug)))
			.orderBy(desc(products.updatedAt));
	}

	/** @inheritdoc */
	listPublished(): Promise<TProductSelect[]> {
		return this.database
			.select()
			.from(products)
			.where(
				and(
					isNull(products.deletedAt),
					isNotNull(products.slug),
					eq(products.isPublished, true),
					eq(products.isActive, true),
				),
			);
	}

	/** @inheritdoc */
	async findBySlug(slug: string): Promise<TProductSelect | null> {
		const [row] = await this.database
			.select()
			.from(products)
			.where(and(eq(products.slug, slug), isNull(products.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	/** @inheritdoc */
	async findPublishedBySlug(slug: string): Promise<TProductSelect | null> {
		const [row] = await this.database
			.select()
			.from(products)
			.where(
				and(
					eq(products.slug, slug),
					isNull(products.deletedAt),
					eq(products.isPublished, true),
					eq(products.isActive, true),
				),
			)
			.limit(1);
		return row ?? null;
	}
	/** Counts alive units of an item, used before archive. */
	async countUnits(productId: string): Promise<number> {
		const [{ value }] = await this.database
			.select({ value: count() })
			.from(itemSerials)
			.where(
				and(
					eq(itemSerials.productId, productId),
					isNull(itemSerials.deletedAt),
					sql`status <> 'lost'`,
				),
			);
		return value;
	}
}
