import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TItemCategoryInsert,
	TItemCategorySelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IItemCategoryRepository,
	TItemCategoryCreateData,
	TItemCategoryPaginationRequest,
	TItemCategoryUpdateData,
} from '../contracts/item-category.repository.interface';
import { ITEM_CATEGORY_REPOSITORY_TOKEN } from '../constants/di';
import {
	ItemCategoryCodeTakenError,
	ItemCategoryNotFoundError,
	ItemRuleViolationError,
} from '../errors/item.errors';
import { InventoryAuditWriter } from '../services/inventory-audit.writer';
import { SYSTEM_AUDIT_ACTOR } from '../constants/audit-actor';
import type { TInventoryAuditActor } from '../constants/audit-actor';
import { ITEM_KINDS } from '@drizzle/schemas/inventory.schema';
import { DEPRECIATION_METHODS } from '@drizzle/schemas/inventory.schema';

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
export class ItemCategoryService {
	constructor(
		@inject(ITEM_CATEGORY_REPOSITORY_TOKEN)
		private readonly categories: IItemCategoryRepository,
		/** Fire-and-forget audit writer, shared with the inventory module. */
		private readonly audit: InventoryAuditWriter,
	) {}

	paginate(
		request: TItemCategoryPaginationRequest,
	): Promise<TPaginationResult<TItemCategorySelect>> {
		return this.categories.paginate(request);
	}

	async getCategory(id: string): Promise<TItemCategorySelect> {
		const category = await this.categories.findById(id);
		if (!category) throw new ItemCategoryNotFoundError();
		return category;
	}

	async createCategory(
		data: TItemCategoryCreateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemCategorySelect> {
		this.assertShape(data);

		const existing = await this.categories.findByCode(
			data.organizationId,
			data.code,
		);
		if (existing) throw new ItemCategoryCodeTakenError();

		if (data.parentCategoryId) {
			await this.requireCategory(data.parentCategoryId);
		}

		const category = await this.categories.create({
			...data,
			createdAt: data.createdAt ?? new Date(),
		} as TItemCategoryCreateData & { createdAt: Date });
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
		data: TItemCategoryUpdateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemCategorySelect> {
		const current = await this.requireCategory(id);

		if (data.itemKind || data.defaultDepreciationMethod) {
			this.assertShape({
				itemKind: data.itemKind ?? current.itemKind,
				defaultDepreciationMethod:
					data.defaultDepreciationMethod ??
					current.defaultDepreciationMethod,
			} as TItemCategoryCreateData);
		}

		if (data.parentCategoryId) {
			if (data.parentCategoryId === id) {
				throw new ItemRuleViolationError('category_parent_self');
			}
			const parent = await this.requireCategory(data.parentCategoryId);
			// Cycle guard: walk up from the new parent; reaching `id` means the
			// category would become its own ancestor.
			let ancestor = parent;
			let depth = 1;
			while (ancestor.parentCategoryId && depth <= MAX_CATEGORY_DEPTH) {
				if (ancestor.parentCategoryId === id) {
					throw new ItemRuleViolationError('category_parent_cycle');
				}
				ancestor = await this.requireCategory(ancestor.parentCategoryId);
				depth += 1;
			}
			if (depth > MAX_CATEGORY_DEPTH) {
				throw new ItemRuleViolationError('category_depth_exceeded');
			}
		}

		const updated = await this.categories.update(id, data);
		if (!updated) throw new ItemCategoryNotFoundError();
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
						itemKind: current.itemKind,
						defaultDepreciationMethod: current.defaultDepreciationMethod,
						isActive: current.isActive,
					},
					{
						name: updated.name,
						itemKind: updated.itemKind,
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
	): Promise<TItemCategorySelect> {
		const current = await this.requireCategory(id);
		const archived = await this.categories.archive(id);
		if (!archived) throw new ItemCategoryNotFoundError();
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
	): Promise<TItemCategorySelect> {
		const category = await this.categories.findById(id);
		if (!category) throw new ItemCategoryNotFoundError();
		return category;
	}

	/** Vocabulary guard — readable 422s ahead of the DB CHECKs. */
	private assertShape(
		data: Pick<TItemCategoryCreateData, 'itemKind' | 'defaultDepreciationMethod'>,
	): void {
		if (!ITEM_KINDS.includes(data.itemKind as never)) {
			throw new ItemRuleViolationError(
				`unknown asset type "${data.itemKind}"`,
			);
		}
		if (
			!DEPRECIATION_METHODS.includes(
				data.defaultDepreciationMethod as never,
			)
		) {
			throw new ItemRuleViolationError(
				`unknown depreciation method "${data.defaultDepreciationMethod}"`,
			);
		}
	}
}

export type { TItemCategoryInsert };
