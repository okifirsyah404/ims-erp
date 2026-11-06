import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TAssetCategoryInsert,
	TAssetCategorySelect,
} from '@drizzle/schemas/asset.schema';
import type {
	IAssetCategoryRepository,
	TAssetCategoryCreateData,
	TAssetCategoryPaginationRequest,
	TAssetCategoryUpdateData,
} from '../contracts/asset-category.repository.interface';
import { ASSET_CATEGORY_REPOSITORY_TOKEN } from '../constants/di';
import {
	AssetCategoryCodeTakenError,
	AssetCategoryNotFoundError,
	AssetRuleViolationError,
} from '../errors/asset.errors';
import { InventoryAuditWriter } from '../../inventory/services/inventory-audit.writer';
import { SYSTEM_AUDIT_ACTOR } from '../../inventory/constants/audit-actor';
import type { TInventoryAuditActor } from '../../inventory/constants/audit-actor';
import { ASSET_TYPES } from '@drizzle/schemas/asset.schema';
import { DEPRECIATION_METHODS } from '@drizzle/schemas/asset.schema';

/** The legal parent categories are plain categories; depth guard lives here. */
const MAX_CATEGORY_DEPTH = 3;

/**
 * Application service for asset categories (Phase A-3).
 *
 * @remarks
 * Cross-field rules the schema cannot express: the type/method vocabulary
 * (mirroring the CHECKs for a readable 422), cycle-free parenting, and the
 * depth cap. All writes audited (D3) and soft-delete only.
 */
@injectable()
export class AssetCategoryService {
	constructor(
		@inject(ASSET_CATEGORY_REPOSITORY_TOKEN)
		private readonly categories: IAssetCategoryRepository,
		/** Fire-and-forget audit writer, shared with the inventory module. */
		private readonly audit: InventoryAuditWriter,
	) {}

	paginate(
		request: TAssetCategoryPaginationRequest,
	): Promise<TPaginationResult<TAssetCategorySelect>> {
		return this.categories.paginate(request);
	}

	async getCategory(id: string): Promise<TAssetCategorySelect> {
		const category = await this.categories.findById(id);
		if (!category) throw new AssetCategoryNotFoundError();
		return category;
	}

	async createCategory(
		data: TAssetCategoryCreateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetCategorySelect> {
		this.assertShape(data);

		const existing = await this.categories.findByCode(
			data.organizationId,
			data.code,
		);
		if (existing) throw new AssetCategoryCodeTakenError();

		if (data.parentCategoryId) {
			await this.requireCategory(data.parentCategoryId);
		}

		const category = await this.categories.create({
			...data,
			createdAt: data.createdAt ?? new Date(),
		} as TAssetCategoryCreateData & { createdAt: Date });
		await this.audit.record({
			actor,
			action: 'asset_category.created',
			targetType: 'asset_category',
			targetId: category.id,
			organizationId: category.organizationId,
			meta: { kind: 'asset_category', code: category.code, name: category.name },
		});
		return category;
	}

	async updateCategory(
		id: string,
		data: TAssetCategoryUpdateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetCategorySelect> {
		const current = await this.requireCategory(id);

		if (data.assetType || data.defaultDepreciationMethod) {
			this.assertShape({
				assetType: data.assetType ?? current.assetType,
				defaultDepreciationMethod:
					data.defaultDepreciationMethod ??
					current.defaultDepreciationMethod,
			} as TAssetCategoryCreateData);
		}

		if (data.parentCategoryId) {
			if (data.parentCategoryId === id) {
				throw new AssetRuleViolationError('category_parent_self');
			}
			const parent = await this.requireCategory(data.parentCategoryId);
			// Cycle guard: walk up from the new parent; reaching `id` means the
			// category would become its own ancestor.
			let ancestor = parent;
			let depth = 1;
			while (ancestor.parentCategoryId && depth <= MAX_CATEGORY_DEPTH) {
				if (ancestor.parentCategoryId === id) {
					throw new AssetRuleViolationError('category_parent_cycle');
				}
				ancestor = await this.requireCategory(ancestor.parentCategoryId);
				depth += 1;
			}
			if (depth > MAX_CATEGORY_DEPTH) {
				throw new AssetRuleViolationError('category_depth_exceeded');
			}
		}

		const updated = await this.categories.update(id, data);
		if (!updated) throw new AssetCategoryNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset_category.updated',
			targetType: 'asset_category',
			targetId: id,
			organizationId: updated.organizationId,
			meta: {
				kind: 'asset_category',
				code: current.code,
				...InventoryAuditWriter.snapshot(
					{
						name: current.name,
						assetType: current.assetType,
						defaultDepreciationMethod: current.defaultDepreciationMethod,
						isActive: current.isActive,
					},
					{
						name: updated.name,
						assetType: updated.assetType,
						defaultDepreciationMethod: updated.defaultDepreciationMethod,
						isActive: updated.isActive,
					},
				),
			},
		});
		return updated;
	}

	async archiveCategory(
		id: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetCategorySelect> {
		const current = await this.requireCategory(id);
		const archived = await this.categories.archive(id);
		if (!archived) throw new AssetCategoryNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset_category.archived',
			targetType: 'asset_category',
			targetId: id,
			organizationId: archived.organizationId,
			meta: { kind: 'asset_category', code: current.code },
		});
		return archived;
	}

	/** Loads an alive category or throws. */
	private async requireCategory(
		id: string,
	): Promise<TAssetCategorySelect> {
		const category = await this.categories.findById(id);
		if (!category) throw new AssetCategoryNotFoundError();
		return category;
	}

	/** Vocabulary guard — readable 422s ahead of the DB CHECKs. */
	private assertShape(
		data: Pick<TAssetCategoryCreateData, 'assetType' | 'defaultDepreciationMethod'>,
	): void {
		if (!ASSET_TYPES.includes(data.assetType as never)) {
			throw new AssetRuleViolationError(
				`unknown asset type "${data.assetType}"`,
			);
		}
		if (
			!DEPRECIATION_METHODS.includes(
				data.defaultDepreciationMethod as never,
			)
		) {
			throw new AssetRuleViolationError(
				`unknown depreciation method "${data.defaultDepreciationMethod}"`,
			);
		}
	}
}

export type { TAssetCategoryInsert };
