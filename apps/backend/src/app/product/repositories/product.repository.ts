import { DRIZZLE_TOKEN } from '@di/provider';
import { type ProductKind, type TProductSelect, products } from '@drizzle/schemas/product.schema';
import { EXPORTED_INVENTORY_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ExportedInventoryService } from '@app/inventory/services/exported-inventory.service';
import type { TPaginationResult } from '@ims-erp/common';
import { paginationResult } from '@utils/pagination.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lte,
	max,
	notInArray,
	or,
	sql,
} from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IProductRepository,
	TProductCreateData,
	TProductListRow,
	TProductPaginationRequest,
	TProductRanges,
	TProductUpdateData,
} from '../contracts/product.repository.interface';
import { stockRangePredicate } from '../utils/stock-range';
import { withWarehouseQuantity } from '../utils/warehouse-quantity';

/**
 * Drizzle implementation of {@link IProductRepository}.
 *
 * @remarks
 * Uncached on purpose: product lists are filtered and small, and the inventory
 * flows that read products (stock movements, borrowing) need a read-your-writes
 * guarantee that a cache-aside layer would complicate.
 *
 * @see {@link import('@drizzle/schemas/product.schema').products} for the
 * nullable-`organization_id` and partial-unique-pair rules this respects.
 */
@injectable()
export class ProductRepository implements IProductRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
		/**
		 * Stock facts the product list needs (ADR-0026): which products have a
		 * physical presence in a warehouse, how much is on hand there, and how
		 * many live units a product still has. All three live in `inventory`.
		 */
		@inject(EXPORTED_INVENTORY_SERVICE_TOKEN)
		private readonly inventory: Pick<
			ExportedInventoryService,
			'productIdsInWarehouse' | 'availableByProducts' | 'availableTotals' | 'countSerials'
		>,
	) {}

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
			status,
			minPrice,
			maxPrice,
			minStock,
			maxStock,
			sortBy,
			sortDir,
		} = request;

		// Stock range: the totals are an `inventory` fact (ADR-0026), applied as an id set.
		const stockPredicate = stockRangePredicate(
			minStock === undefined && maxStock === undefined ? [] : await this.inventory.availableTotals(),
			minStock,
			maxStock,
		);
		const stockFilter = !stockPredicate
			? undefined
			: stockPredicate.mode === 'notIn'
				? stockPredicate.ids.length > 0
					? notInArray(products.id, stockPredicate.ids)
					: undefined
				: stockPredicate.ids.length > 0
					? inArray(products.id, stockPredicate.ids)
					: sql`false`;
		const sortColumn =
			sortBy === 'code' ? products.code : sortBy === 'price' ? products.sellingPrice : products.name;
		const direction = sortDir === 'desc' ? desc : asc;

		// "Has a physical presence in this warehouse": either a live serialized
		// unit or a stock balance. The units and balances live in `inventory`,
		// so the id set comes from its facade (ADR-0026) instead of an EXISTS
		// over another module's tables. `inArray` keeps the row multiplicity of
		// the outer query intact.
		const warehouseProductIds =
			warehouseId === undefined
				? undefined
				: await this.inventory.productIdsInWarehouse(warehouseId);

		const filters = [
			includeArchived ? undefined : isNull(products.deletedAt),
			productKind ? eq(products.productKind, productKind) : undefined,
			productCategoryId ? eq(products.productCategoryId, productCategoryId) : undefined,
			// `status` wins over the older `activeOnly` shorthand.
			status === 'inactive'
				? eq(products.isActive, false)
				: status === 'active' || (status === undefined && activeOnly)
					? eq(products.isActive, true)
					: undefined,
			minPrice === undefined ? undefined : gte(products.sellingPrice, minPrice),
			maxPrice === undefined ? undefined : lte(products.sellingPrice, maxPrice),
			stockFilter,
			warehouseProductIds ? inArray(products.id, warehouseProductIds) : undefined,
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

		const rows = await this.database
			.select()
			.from(products)
			.where(where)
			.orderBy(direction(sortColumn), asc(products.name))
			.limit(limit)
			.offset((page - 1) * limit);

		// The warehouse-scoped quantity is aggregated by the owning module (one
		// grouped query for the page), never by joining another module's table
		// here. Without a warehouse filter the column is NULL.
		const available =
			warehouseId === undefined
				? undefined
				: await this.inventory.availableByProducts(rows.map((row) => row.id));

		const data = withWarehouseQuantity(
			rows,
			available === undefined
				? undefined
				: new Map(available.map((row) => [row.productId, row.available])),
		);

		return paginationResult({ page, limit }, total, data);
	}

	/** Slider bounds for the list filters: highest price and highest summed stock of a kind. */
	async ranges(productKind?: ProductKind): Promise<TProductRanges> {
		const where = and(isNull(products.deletedAt), productKind ? eq(products.productKind, productKind) : undefined);
		const [{ maxPrice }] = await this.database
			.select({ maxPrice: max(products.sellingPrice) })
			.from(products)
			.where(where);

		const totals = await this.inventory.availableTotals();
		let maxStock = 0;
		if (totals.length > 0) {
			// Only products of this kind count toward the stock slider.
			const live = await this.database
				.select({ id: products.id })
				.from(products)
				.where(and(where, inArray(products.id, totals.map((row) => row.productId))));
			const liveIds = new Set(live.map((row) => row.id));
			maxStock = Math.max(0, ...totals.filter((row) => liveIds.has(row.productId)).map((row) => row.available));
		}
		return { maxSellingPrice: Number(maxPrice ?? 0), maxStock };
	}

	/** Fetches one alive product by id. */
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
	 * Fetches one alive product by tenant + SKU.
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

	/** Inserts a product; the `code` comes from the numbering authority. */
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
	 * Applies a partial update to an alive product.
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

	/** Soft-deletes an alive product. */
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
	): Promise<
		Array<{ id: string; name: string; sku: string; unitLabel: string; imageObjectKey: string | null }>
	> {
		if (ids.length === 0) return [];
		return this.database
			.select({
				id: products.id,
				name: products.name,
				sku: products.sku,
				unitLabel: products.unitLabel,
				imageObjectKey: products.imageObjectKey,
			})
			.from(products)
			.where(and(inArray(products.id, ids), isNull(products.deletedAt)));
	}

	/** @inheritdoc */
	async findByIds(ids: string[]): Promise<TProductSelect[]> {
		if (ids.length === 0) return [];
		return this.database.select().from(products).where(inArray(products.id, ids));
	}

	/** @inheritdoc */
	async productKinds(ids: string[]): Promise<Array<{ id: string; productKind: string }>> {
		if (ids.length === 0) return [];
		return this.database
			.select({ id: products.id, productKind: products.productKind })
			.from(products)
			.where(inArray(products.id, ids));
	}

	/** @inheritdoc */
	async searchByNameOrSku(search: string): Promise<Array<{ id: string }>> {
		return this.database
			.select({ id: products.id })
			.from(products)
			.where(
				and(
					isNull(products.deletedAt),
					or(ilike(products.sku, `%${search}%`), ilike(products.name, `%${search}%`)),
				),
			);
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
	/**
	 * Counts alive units of a product, used before archive.
	 *
	 * @remarks
	 * The unit rows stayed in `inventory` (ADR-0026), so the count is read
	 * through its facade rather than from this module's database.
	 */
	async countUnits(productId: string): Promise<number> {
		return this.inventory.countSerials(productId);
	}
}
