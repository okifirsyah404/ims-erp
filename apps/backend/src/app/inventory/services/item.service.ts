import { inject, injectable } from 'tsyringe';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	ItemKind,
	ItemStatus,
	TItemSelect,
} from '@drizzle/schemas/inventory.schema';
import { ITEM_KINDS } from '@drizzle/schemas/inventory.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import type { ExportedInventoryService } from './exported-inventory.service';
import type { InventoryNumberingService } from './inventory-numbering.service';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type { TItemCreateData } from '../contracts/item.repository.interface';
import {
	EXPORTED_INVENTORY_SERVICE_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_CATEGORY_REPOSITORY_TOKEN,
	ITEM_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import {
	ItemCategoryNotFoundError,
	ItemNotFoundError,
	ItemRuleViolationError,
	ItemTransitionError,
} from '../errors/item.errors';
import { InventoryAuditWriter } from '../services/inventory-audit.writer';
import { SYSTEM_AUDIT_ACTOR } from '../constants/audit-actor';
import type { TInventoryAuditActor } from '../constants/audit-actor';

/**
 * Legal status edges for the asset lifecycle (D12/D18/D21).
 *
 * @remarks
 * `inactive` is the D18 parked state (enter from any non-terminal status,
 * leave back to `ready`). `disposed` is terminal and only reachable via
 * the disposal workflow (D21) — never through `update`.
 *
 * ERP-0036 D7 vocabulary: `in_stock` → `ready`, `in_use` → `borrowed`.
 * Custody statuses are derived by `AssetOperationsService.reconcileStatus`
 * (open borrowing / open maintenance), not written by this lifecycle.
 */
export const ITEM_STATUS_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
	ready: ['borrowed', 'maintenance', 'inactive', 'lost'],
	borrowed: ['ready', 'maintenance', 'inactive', 'lost'],
	maintenance: ['ready', 'inactive', 'lost'],
	inactive: ['ready', 'lost'],
	lost: [],
	disposed: [],
};

/** The actor context for custody/lifecycle operations. */
export type TItemActor = TInventoryAuditActor;

/** One asset row decorated with its storage warehouse's name. */
export type TItemWithLocation = TItemSelect & {
	/** Resolved `inventory.warehouses.name`; `null` when unallocated. */
	warehouseName: string | null;
};

/**
 * Application service for the asset register (Phase A-3).
 *
 * @remarks
 * Owns the cross-field rules the schema cannot express: the status machine,
 * category/type coherence, book-value derivation, ERP-0009 code minting
 * (D15) and the soft-delete-only rule. All writes are audited (D3) and
 * transactional; disposal execution flips the asset status inside the same
 * transaction as the disposal record (D21).
 */
@injectable()
export class ItemService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: IItemRepository,
		@inject(ITEM_CATEGORY_REPOSITORY_TOKEN)
		private readonly categoryRepository: IItemCategoryRepository,
		/** ERP-0009 numbering authority (D15). */
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		/** Fire-and-forget audit writer, shared with the inventory module. */
		private readonly audit: InventoryAuditWriter,
		/** Storage-location name resolution via inventory's export facade. */
		@inject(EXPORTED_INVENTORY_SERVICE_TOKEN)
		private readonly exportedInventoryService: ExportedInventoryService,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	paginate(
		request: Parameters<IItemRepository['paginate']>[0],
	): Promise<TPaginationResult<TItemWithLocation>> {
		return this.paginateWithLocation(request);
	}

	async getItem(id: string): Promise<TItemWithLocation> {
		const asset = await this.requireItem(id);
		const [withLocation] = await this.withWarehouseNames([asset]);
		return withLocation;
	}

	/** Item kinds (the former sset_types lookup, now a closed vocabulary). */
	listKinds(): readonly ItemKind[] {
		return ITEM_KINDS;
	}

	/**
	 * Decorates asset rows with the storage warehouse's name.
	 *
	 * @remarks
	 * `warehouseId` is a logical reference to `inventory.warehouses.id`, so the
	 * name crosses the module boundary as a service-to-service call per the
	 * module rules — this module never queries the inventory schema directly.
	 */
	private async withWarehouseNames(
		rows: TItemSelect[],
	): Promise<TItemWithLocation[]> {
		const warehouseIds = [
			...new Set(
				rows.flatMap((asset) => (asset.warehouseId ? [asset.warehouseId] : [])),
			),
		];
		const nameMap =
			warehouseIds.length > 0
				? await this.exportedInventoryService.getNameMap(warehouseIds)
				: new Map<string, string>();
		return rows.map((asset) => ({
			...asset,
			warehouseName:
				(asset.warehouseId ? nameMap.get(asset.warehouseId) : undefined) ?? null,
		}));
	}

	private async paginateWithLocation(
		request: Parameters<IItemRepository['paginate']>[0],
	): Promise<TPaginationResult<TItemWithLocation>> {
		const result = await this.itemRepository.paginate(request);
		return {
			...result,
			data: await this.withWarehouseNames(result.data),
		};
	}

	/**
	 * Registers a new asset. The code is sequence-allocated (D15) inside the
	 * creating transaction; `book_value` starts at the acquisition cost.
	 */
	async registerItem(
		data: TItemCreateData,
		actor: TItemActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		const { organizationId, ...rest } = data;
		if (rest.itemCategoryId) await this.requireCategory(rest.itemCategoryId);

		const created = await this.transactions.run(async (tx) => {
			// D13: one company-wide `AST-…` space, so the globally-unique code
			// index can never collide across scopes.
			const code = await this.numbering.next('asset', tx);
			return this.itemRepository.create(
				{
					...rest,
					organizationId,
					code,
					createdAt: rest.createdAt ?? new Date(),
					status: 'ready',
					accumulatedDepreciation: 0,
					bookValue: rest.acquisitionCost ?? 0,
				},
				tx,
			);
		});

		await this.audit.record({
			actor,
			action: 'asset.created',
			targetType: 'asset',
			targetId: created.id,
			organizationId,
			meta: {
				code: created.code,
				name: created.name,
				itemKind: created.itemKind,
				acquisitionCost: created.acquisitionCost,
			},
		});
		return created;
	}

	/**
	 * Updates the mutable master-data columns. `code`, `status`, valuation
	 * columns and custody are NOT editable here — status moves through the
	 * dedicated operations, valuation through depreciation/disposal.
	 */
	async updateItem(
		id: string,
		data: Parameters<IItemRepository['update']>[1],
		actor: TItemActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		const current = await this.requireItem(id);
		if (current.status === 'disposed') {
			throw new ItemTransitionError(current.status, 'updated');
		}
		if (data.itemCategoryId) await this.requireCategory(data.itemCategoryId);

		const updated = await this.itemRepository.update(id, data);
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.updated',
			targetType: 'asset',
			targetId: id,
			organizationId: updated.organizationId,
			meta: {
				code: current.code,
				...InventoryAuditWriter.snapshot(
					{
						name: current.name,
						description: current.description,
						itemCategoryId: current.itemCategoryId,
						locationDescription: current.locationDescription,
						imageUrl: current.imageUrl,
						acquisitionCost: current.acquisitionCost,
					},
					{
						name: updated.name,
						description: updated.description,
						itemCategoryId: updated.itemCategoryId,
						locationDescription: updated.locationDescription,
						imageUrl: updated.imageUrl,
						acquisitionCost: updated.acquisitionCost,
					},
				),
			},
		});
		return updated;
	}

	/**
	 * D18: parks an asset with a mandatory reason. Legal from any
	 * non-terminal status; use {@link reactivateItem} to bring it back.
	 */
	async deactivateItem(
		id: string,
		reason: string,
		actor: TItemActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		const current = await this.requireItem(id);
		if (
			!ITEM_STATUS_TRANSITIONS[current.status as ItemStatus].includes(
				'inactive',
			)
		) {
			throw new ItemTransitionError(current.status, 'inactive');
		}
		const updated = await this.itemRepository.update(id, {
			status: 'inactive',
			deactivationReason: reason,
		});
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.deactivated',
			targetType: 'asset',
			targetId: id,
			organizationId: updated.organizationId,
			meta: { code: current.code, from: current.status, reason },
		});
		return updated;
	}

	/** D18: brings a parked asset back to `ready`, clearing the reason. */
	async reactivateItem(
		id: string,
		actor: TItemActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		const current = await this.requireItem(id);
		if (current.status !== 'inactive') {
			throw new ItemTransitionError(current.status, 'ready');
		}
		const updated = await this.itemRepository.update(id, {
			status: 'ready',
			deactivationReason: null,
		});
		if (!updated) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.reactivated',
			targetType: 'asset',
			targetId: id,
			organizationId: updated.organizationId,
			meta: { code: current.code },
		});
		return updated;
	}

	/**
	 * Soft delete — the only delete path (financial master-data rule).
	 * Live custody or maintenance history blocks the archive defensively;
	 * once accounting references exist they will block it too (D13 forward
	 * compatibility).
	 */
	async archiveItem(
		id: string,
		actor: TItemActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemSelect> {
		const current = await this.requireItem(id);
		const references =
			await this.itemRepository.countReferences(id);
		if (references.borrowings > 0 || references.maintenances > 0) {
			throw new ItemRuleViolationError(
				`asset_has_history:${references.borrowings}/${references.maintenances}`,
				'assets.assetHasHistory',
				'Cannot archive an asset with borrowing or maintenance history',
			);
		}
		const archived = await this.itemRepository.archive(id);
		if (!archived) throw new ItemNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.archived',
			targetType: 'asset',
			targetId: id,
			organizationId: archived.organizationId,
			meta: { code: current.code, status: current.status },
		});
		return archived;
	}

	/**
	 * Applies a depreciation posting to the item's valuation (called by finance,
	 * which owns `asset_depreciations`; ADR-0024 Q15).
	 *
	 * @remarks
	 * The only writer of `book_value` and `accumulated_depreciation` after
	 * registration. Joins the caller's transaction so the depreciation row and the
	 * valuation commit together.
	 *
	 * @throws {ItemRuleViolationError} When the amount is negative or exceeds the book value
	 */
	async applyDepreciation(
		id: string,
		organizationId: string,
		depreciationAmount: number,
		tx?: TTx,
	): Promise<TItemSelect> {
		if (!Number.isInteger(depreciationAmount) || depreciationAmount < 0) {
			throw new ItemRuleViolationError('negative_depreciation');
		}
		const item = await this.requireItem(id);
		if (item.organizationId !== organizationId) throw new ItemNotFoundError();
		if (depreciationAmount > item.bookValue) {
			throw new ItemRuleViolationError(
				'depreciation_exceeds_book_value',
				'assets.depreciationExceedsBookValue',
				'Depreciation cannot exceed the remaining book value',
			);
		}
		const updated = await this.itemRepository.update(
			id,
			{
				bookValue: item.bookValue - depreciationAmount,
				accumulatedDepreciation: item.accumulatedDepreciation + depreciationAmount,
			},
			tx,
		);
		if (!updated) throw new ItemNotFoundError();
		return updated;
	}

	/** Loads an alive item or throws. */
	private async requireItem(id: string): Promise<TItemSelect> {
		const asset = await this.itemRepository.findById(id);
		if (!asset) throw new ItemNotFoundError();
		return asset;
	}

	/** Loads an alive category or throws (used on category references). */
	private async requireCategory(id: string) {
		const category = await this.categoryRepository.findById(id);
		if (!category) throw new ItemCategoryNotFoundError();
		return category;
	}
}
