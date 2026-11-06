import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	AssetStatus,
	TAssetSelect,
} from '@drizzle/schemas/asset.schema';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { EXPORTED_WAREHOUSE_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { ExportedWarehouseService } from '@app/inventory/services/exported-warehouse.service';import type { IAssetRepository } from '../contracts/asset.repository.interface';
import type { TAssetCreateData } from '../contracts/asset.repository.interface';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import {
	ASSET_REPOSITORY_TOKEN,
	ASSET_CATEGORY_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IAssetCategoryRepository } from '../contracts/asset-category.repository.interface';
import { ASSET_DOC_TYPES } from '../constants/doc-types';
import {
	AssetCategoryNotFoundError,
	AssetNotFoundError,
	AssetRuleViolationError,
	AssetTransitionError,
} from '../errors/asset.errors';
import { InventoryAuditWriter } from '../../inventory/services/inventory-audit.writer';
import { SYSTEM_AUDIT_ACTOR } from '../../inventory/constants/audit-actor';
import type { TInventoryAuditActor } from '../../inventory/constants/audit-actor';

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
export const ASSET_STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
	ready: ['borrowed', 'maintenance', 'inactive', 'lost'],
	borrowed: ['ready', 'maintenance', 'inactive', 'lost'],
	maintenance: ['ready', 'inactive', 'lost'],
	inactive: ['ready', 'lost'],
	lost: [],
	disposed: [],
};

/** The actor context for custody/lifecycle operations. */
export type TAssetActor = TInventoryAuditActor;

/** One asset row decorated with its storage warehouse's name. */
export type TAssetWithLocation = TAssetSelect & {
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
export class AssetService {
	constructor(
		@inject(ASSET_REPOSITORY_TOKEN)
		private readonly assetRepository: IAssetRepository,
		@inject(ASSET_CATEGORY_REPOSITORY_TOKEN)
		private readonly categoryRepository: IAssetCategoryRepository,
		/** ERP-0009 numbering authority (D15). */
		@inject(NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<NumberingService, 'next'>,
		/** Fire-and-forget audit writer, shared with the inventory module. */
		private readonly audit: InventoryAuditWriter,
		/** Storage-location name resolution via inventory's export facade. */
		@inject(EXPORTED_WAREHOUSE_SERVICE_TOKEN)
		private readonly exportedWarehouseService: ExportedWarehouseService,
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	paginate(
		request: Parameters<IAssetRepository['paginate']>[0],
	): Promise<TPaginationResult<TAssetWithLocation>> {
		return this.paginateWithLocation(request);
	}

	async getAsset(id: string): Promise<TAssetWithLocation> {
		const asset = await this.requireAsset(id);
		const [withLocation] = await this.withWarehouseNames([asset]);
		return withLocation;
	}

	/** Active asset types (lookup table, global reference data). */
	listTypes(): ReturnType<IAssetRepository['listTypes']> {
		return this.assetRepository.listTypes();
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
		assets: TAssetSelect[],
	): Promise<TAssetWithLocation[]> {
		const warehouseIds = [
			...new Set(
				assets.flatMap((asset) => (asset.warehouseId ? [asset.warehouseId] : [])),
			),
		];
		const nameMap =
			warehouseIds.length > 0
				? await this.exportedWarehouseService.getNameMap(warehouseIds)
				: new Map<string, string>();
		return assets.map((asset) => ({
			...asset,
			warehouseName:
				(asset.warehouseId ? nameMap.get(asset.warehouseId) : undefined) ?? null,
		}));
	}

	private async paginateWithLocation(
		request: Parameters<IAssetRepository['paginate']>[0],
	): Promise<TPaginationResult<TAssetWithLocation>> {
		const result = await this.assetRepository.paginate(request);
		return {
			...result,
			data: await this.withWarehouseNames(result.data),
		};
	}

	/**
	 * Registers a new asset. The code is sequence-allocated (D15) inside the
	 * creating transaction; `book_value` starts at the acquisition cost.
	 */
	async registerAsset(
		data: TAssetCreateData,
		actor: TAssetActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetSelect> {
		const { organizationId, ...rest } = data;
		if (rest.categoryId) await this.requireCategory(rest.categoryId);

		const created = await this.database.transaction(async (tx) => {
			// D13: one company-wide `AST-…` space, so the globally-unique code
			// index can never collide across scopes.
			const code = await this.numbering.next(ASSET_DOC_TYPES.asset, { tx });
			return this.assetRepository.create(
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
				assetType: created.assetType,
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
	async updateAsset(
		id: string,
		data: Parameters<IAssetRepository['update']>[1],
		actor: TAssetActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetSelect> {
		const current = await this.requireAsset(id);
		if (current.status === 'disposed') {
			throw new AssetTransitionError(current.status, 'updated');
		}
		if (data.categoryId) await this.requireCategory(data.categoryId);

		const updated = await this.assetRepository.update(id, data);
		if (!updated) throw new AssetNotFoundError();
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
						categoryId: current.categoryId,
						locationDescription: current.locationDescription,
						imageUrl: current.imageUrl,
						acquisitionCost: current.acquisitionCost,
					},
					{
						name: updated.name,
						description: updated.description,
						categoryId: updated.categoryId,
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
	 * non-terminal status; use {@link reactivateAsset} to bring it back.
	 */
	async deactivateAsset(
		id: string,
		reason: string,
		actor: TAssetActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetSelect> {
		const current = await this.requireAsset(id);
		if (
			!ASSET_STATUS_TRANSITIONS[current.status as AssetStatus].includes(
				'inactive',
			)
		) {
			throw new AssetTransitionError(current.status, 'inactive');
		}
		const updated = await this.assetRepository.update(id, {
			status: 'inactive',
			deactivationReason: reason,
		});
		if (!updated) throw new AssetNotFoundError();
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
	async reactivateAsset(
		id: string,
		actor: TAssetActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetSelect> {
		const current = await this.requireAsset(id);
		if (current.status !== 'inactive') {
			throw new AssetTransitionError(current.status, 'ready');
		}
		const updated = await this.assetRepository.update(id, {
			status: 'ready',
			deactivationReason: null,
		});
		if (!updated) throw new AssetNotFoundError();
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
	async archiveAsset(
		id: string,
		actor: TAssetActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetSelect> {
		const current = await this.requireAsset(id);
		const references =
			await this.assetRepository.countReferences(id);
		if (references.borrowings > 0 || references.maintenances > 0) {
			throw new AssetRuleViolationError(
				`asset_has_history:${references.borrowings}/${references.maintenances}`,
				'assets.assetHasHistory',
				'Cannot archive an asset with borrowing or maintenance history',
			);
		}
		const archived = await this.assetRepository.archive(id);
		if (!archived) throw new AssetNotFoundError();
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

	/** Loads an alive asset or throws. */
	private async requireAsset(id: string): Promise<TAssetSelect> {
		const asset = await this.assetRepository.findById(id);
		if (!asset) throw new AssetNotFoundError();
		return asset;
	}

	/** Loads an alive category or throws (used on category references). */
	private async requireCategory(id: string) {
		const category = await this.categoryRepository.findById(id);
		if (!category) throw new AssetCategoryNotFoundError();
		return category;
	}
}
