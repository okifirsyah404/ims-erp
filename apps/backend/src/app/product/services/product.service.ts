import { inject, injectable } from 'tsyringe';
import { AuditWriter, SYSTEM_AUDIT_ACTOR, type TAuditActor } from '@shared/audit';
import type { ProductNumberingService } from './product-numbering.service';
import type { TPaginationResult } from '@ims-erp/common';
import type { ProductKind, TProductSelect } from '@drizzle/schemas/product.schema';
import type {
	IProductRepository,
	TProductCreateData,
	TProductListRow,
	TProductPaginationRequest,
	TProductUpdateData,
} from '../contracts/product.repository.interface';
import {
	EXPORTED_PRODUCT_SERVICE_TOKEN,
	PRODUCT_NUMBERING_SERVICE_TOKEN,
	PRODUCT_REPOSITORY_TOKEN,
} from '../constants/di';
import type { ExportedProductService } from './exported-product.service';
import {
	ProductHasSerialsError,
	ProductNotFoundError,
	ProductRuleViolationError,
} from '../errors/product.errors';

/**
 * Code type each product kind is numbered with (ERP-0043).
 *
 * @remarks
 * One series per kind, so a product can never consume a material number.
 * `productKind` arrives as a plain `text` value from the schema insert type, so
 * {@link productCodeType} narrows it instead of indexing this map directly.
 */
const PRODUCT_CODE_TYPES = {
	product: 'item_product',
	material: 'item_material',
	component: 'item_component',
} as const satisfies Record<ProductKind, string>;

/** Narrows a stored `product_kind` to its code type. */
function productCodeType(kind: string) {
	const codeType = PRODUCT_CODE_TYPES[kind as ProductKind];
	if (!codeType) {
		throw new ProductRuleViolationError(`Unknown product kind: ${kind}`);
	}
	return codeType;
}

/**
 * Application service for the product (SKU) master.
 *
 * @remarks
 * Owns the cross-field rules the schema cannot express and mints the product
 * code. The serial units live in `inventory`'s `SerialUnitService` (ADR-0026),
 * and the shared checks other callers also need (SKU free, category usable,
 * unit count) are read through the module's own export facade, so the rules
 * live in one place and the composition stays a single wiring point.
 */
@injectable()
export class ProductService {
	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly products: IProductRepository,
		/** The module's export facade: shared checks + the unit count. */
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN)
		private readonly exported: Pick<
			ExportedProductService,
			'assertSkuFree' | 'assertCategoryUsable' | 'countUnits'
		>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: AuditWriter,
		/** ERP-0043: product codes are allocated, never typed. */
		@inject(PRODUCT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<ProductNumberingService, 'next'>,
	) {}

	/** Fetches one filtered page of products. */
	paginate(
		request: TProductPaginationRequest,
	): Promise<TPaginationResult<TProductListRow>> {
		return this.products.paginate(request);
	}

	/**
	 * Fetches one product.
	 *
	 * @throws {ProductNotFoundError} When the product is absent or archived
	 */
	async getProduct(id: string): Promise<TProductSelect> {
		const product = await this.products.findById(id);
		if (!product) throw new ProductNotFoundError();
		return product;
	}

	/**
	 * Active products among `ids`, for modules putting products on new
	 * documents (sales quotations). Missing, archived and inactive products are
	 * skipped; the caller reports which ones it did not get back.
	 */
	getActiveProducts(ids: string[]): Promise<TProductSelect[]> {
		return this.products.findActiveByIds([...new Set(ids)]);
	}

	/**
	 * Creates a product.
	 *
	 * @remarks
	 * ERP-0043: the product `code` is allocated by the numbering authority per
	 * kind (`PRD-`/`MAT-`/`CMP-`; ADR-0026 adds the `{COMPANY}` token); the
	 * client never sends it. `sku` and `serialNumber` stay user-typed, and the
	 * code is immutable afterwards.
	 *
	 * @throws {ProductRuleViolationError} When the kind/data combination is
	 * impossible (e.g. a serialized product that is not stock-tracked)
	 * @throws {ProductSkuTakenError} When the SKU is already used for this tenant
	 */
	async createProduct(
		data: TProductCreateData,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TProductSelect> {
		this.assertProductShape(data);
		if (data.productCategoryId) {
			await this.exported.assertCategoryUsable(data.productCategoryId);
		}
		await this.exported.assertSkuFree(data.organizationId ?? null, data.sku);

		const code = await this.numbering.next(productCodeType(data.productKind));
		const product = await this.products.create(data, code);
		await this.audit.record({
			actor,
			action: 'item.created',
			targetType: 'item',
			targetId: product.id,
			organizationId: product.organizationId,
			meta: {
				code: product.code,
				sku: product.sku,
				name: product.name,
				productKind: product.productKind,
			},
		});
		return product;
	}

	/**
	 * Updates a product.
	 *
	 * @remarks
	 * `sku` and `product_kind` are deliberately not updatable: both are load
	 * bearing for uniqueness and for the unit status matrix, and changing
	 * either would silently invalidate existing units.
	 *
	 * @throws {ProductNotFoundError} When the product is absent or archived
	 * @throws {ProductRuleViolationError} When the result would be impossible
	 */
	async updateProduct(
		id: string,
		data: TProductUpdateData,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TProductSelect> {
		const current = await this.getProduct(id);
		// A newly chosen category must exist and be active; a product may keep
		// the (now inactive) category it already has.
		if (
			data.productCategoryId &&
			data.productCategoryId !== current.productCategoryId
		) {
			await this.exported.assertCategoryUsable(data.productCategoryId);
		}

		if (Object.keys(data).length > 0) {
			this.assertProductShape({ ...current, ...data } as TProductCreateData);
		}

		const updated = await this.products.update(id, data);
		if (!updated) throw new ProductNotFoundError();
		await this.audit.record({
			actor,
			action: 'item.updated',
			targetType: 'item',
			targetId: id,
			organizationId: updated.organizationId,
			meta: AuditWriter.snapshot(
				{
					name: current.name,
					purchasePrice: current.purchasePrice,
					sellingPrice: current.sellingPrice,
					description: current.description,
				},
				{
					name: updated.name,
					purchasePrice: updated.purchasePrice,
					sellingPrice: updated.sellingPrice,
					description: updated.description,
				},
			),
		});
		return updated;
	}

	/**
	 * Archives a product.
	 *
	 * @throws {ProductNotFoundError} When the product is absent or archived
	 * @throws {ProductHasSerialsError} When live units still reference it
	 */
	async archiveProduct(
		id: string,
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TProductSelect> {
		await this.getProduct(id);

		const units = await this.exported.countUnits(id);
		if (units > 0) throw new ProductHasSerialsError(units);

		const archived = await this.products.archive(id);
		if (!archived) throw new ProductNotFoundError();
		await this.audit.record({
			actor,
			action: 'item.archived',
			targetType: 'item',
			targetId: id,
			organizationId: archived.organizationId,
			meta: { sku: archived.sku },
		});
		return archived;
	}

	/**
	 * Enforces the product shape rules.
	 *
	 * @throws {ProductRuleViolationError} When the shape is impossible
	 */
	private assertProductShape(data: TProductCreateData): void {
		if (data.isSerialized && !data.isStockTracked) {
			throw new ProductRuleViolationError(
				'A serialized product must be stock-tracked',
			);
		}
	}
}
