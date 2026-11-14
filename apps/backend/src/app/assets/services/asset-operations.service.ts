import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TAssetConditionCheckSelect,
	TAssetDepreciationSelect,
	TAssetDisposalSelect,
	TAssetDocumentSelect,
	TAssetMaintenanceSelect,
	TAssetMovementSelect,
	TAssetSelect,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/asset.schema';
import type { AssetStatus } from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';
import {
	ASSET_CONDITIONS,
	ASSET_STATUSES,
	CONDITION_CHECK_STATUSES,
	DISPOSAL_METHODS,
	DISPOSAL_STATUSES,
	DOCUMENT_TYPES_ASSET,
	MAINTENANCE_STATUSES,
	MAINTENANCE_TYPES,
	MOVEMENT_TYPES_ASSET,
	TOOL_SET_STATUSES,
} from '@drizzle/schemas/asset.schema';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { ASSET_REPOSITORY_TOKEN, ASSET_OPERATIONS_REPOSITORY_TOKEN } from '../constants/di';
import type { IAssetRepository } from '../contracts/asset.repository.interface';
import type { IAssetOperationsRepository } from '../contracts/asset-operations.repository.interface';
import { WAREHOUSE_SERVICE_TOKEN } from '@app/inventory/constants/di';
import type { WarehouseService } from '@app/inventory/services/warehouse.service';
import { ASSET_DOC_TYPES } from '../constants/doc-types';
import {
	AssetNotFoundError,
	AssetRuleViolationError,
	AssetTransitionError,
} from '../errors/asset.errors';
import { InventoryAuditWriter } from '../../inventory/services/inventory-audit.writer';
import { WarehouseNotFoundError } from '../../inventory/errors/inventory.errors';
import { SYSTEM_AUDIT_ACTOR } from '../../inventory/constants/audit-actor';
import type { TInventoryAuditActor } from '../../inventory/constants/audit-actor';

/** The actor context for asset operations. */
export type TAssetOperationActor = TInventoryAuditActor;

/** Condition vocabulary mirror for readable 422s. */
const CONDITION_VALUES = ASSET_CONDITIONS;

/**
 * Application service for the asset operation ledgers (Phase A-3): custody
 * (D12 full loan flow), movements, condition checks, maintenances, manual
 * depreciation entries (D14), the disposal workflow (D21), documents (D19)
 * and tool sets (D11).
 *
 * @remarks
 * All writes transactional; the return and disposal-execution transitions
 * use atomic conditional claims (the Phase I-4 lesson). Every write is
 * audited fire-and-forget (D3).
 */
@injectable()
export class AssetOperationsService {
	constructor(
		@inject(ASSET_REPOSITORY_TOKEN)
		private readonly assetRepository: IAssetRepository,
		@inject(ASSET_OPERATIONS_REPOSITORY_TOKEN)
		private readonly operations: IAssetOperationsRepository,
		/** ERP-0009 numbering authority (D15). */
		@inject(CODE_NUMBER_SERVICE_TOKEN)
		private readonly numbering: Pick<CodeNumberService, 'next'>,
		/** Fire-and-forget audit writer, shared with the inventory module. */
		private readonly audit: InventoryAuditWriter,
		/** Inventory owns warehouses/storages; Assets validates through this port. */
		@inject(WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: WarehouseService,
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/* =============================== custody ============================= */

	/**
	 * D7: derives the asset's status from facts it already records.
	 *
	 * @remarks
	 * `inactive` is asset-owned and sticky; `disposed`/`lost` are terminal.
	 * Everything else follows custody: an open borrowing means `borrowed`, an
	 * unfinished maintenance means `maintenance`, otherwise `ready`.
	 */
	async reconcileStatus(
		assetId: string,
		tx?: TTx,
	): Promise<TAssetSelect | null> {
		const asset = await this.requireAsset(assetId);
		if (['inactive', 'disposed', 'lost'].includes(asset.status)) return asset;
		const [open, maintenance] = await Promise.all([
			this.operations.findOpenBorrowingLine(assetId, tx),
			this.operations.hasOpenMaintenance(assetId, tx),
		]);
		const status: AssetStatus = open
			? 'borrowed'
			: maintenance
				? 'maintenance'
				: 'ready';
		if (status === asset.status) return asset;
		return this.assetRepository.update(assetId, { status }, tx);
	}

	/**
	 * D8: writes the custody snapshot.
	 *
	 * @remarks
	 * `borrowed_since` is the issue time of the open borrowing line, or NULL
	 * once nothing is out. `custodian_employee_id` is not derived here: a
	 * borrowing names a user, customer, or guest, never an employee row.
	 */
	async syncCustody(assetId: string, tx?: TTx): Promise<TAssetSelect | null> {
		const open = await this.operations.findOpenBorrowingLine(assetId, tx);
		return this.assetRepository.update(
			assetId,
			{ borrowedSince: open?.issuedAt ?? null },
			tx,
		);
	}

	/** Writes one `borrow_out` movement and takes the asset off-site (D4). */
	async borrowOut(
		assetId: string,
		organizationId: string,
		data: {
			warehouseId: string;
			storageId: string | null;
			toLocation?: string | null;
			condition?: string | null;
			notes?: string | null;
			at?: Date;
		},
		actor: TAssetOperationActor,
		tx: TTx,
	): Promise<TAssetMovementSelect> {
		const at = data.at ?? new Date();
		const movement = await this.operations.createMovement(
			{
				organizationId,
				assetId,
				movementType: 'borrow_out',
				fromWarehouseId: data.warehouseId,
				fromStorageId: data.storageId,
				toLocation: data.toLocation ?? null,
				movedAt: at,
				movedByUserId: actor.userId,
				condition: data.condition ?? null,
				notes: data.notes ?? null,
				createdAt: at,
			},
			tx,
		);
		// The asset has no location while it is out; the line snapshots it.
		await this.assetRepository.update(
			assetId,
			{ warehouseId: null, storageId: null },
			tx,
		);
		return movement;
	}

	/** Writes one `borrow_return` movement and restores the asset's location. */
	async borrowReturn(
		assetId: string,
		organizationId: string,
		data: {
			warehouseId: string;
			storageId: string | null;
			condition?: string | null;
			notes?: string | null;
			at?: Date;
		},
		actor: TAssetOperationActor,
		tx: TTx,
	): Promise<TAssetMovementSelect> {
		const at = data.at ?? new Date();
		const movement = await this.operations.createMovement(
			{
				organizationId,
				assetId,
				movementType: 'borrow_return',
				toWarehouseId: data.warehouseId,
				toStorageId: data.storageId,
				movedAt: at,
				movedByUserId: actor.userId,
				condition: data.condition ?? null,
				notes: data.notes ?? null,
				createdAt: at,
			},
			tx,
		);
		await this.assetRepository.update(
			assetId,
			{ warehouseId: data.warehouseId, storageId: data.storageId },
			tx,
		);
		return movement;
	}

	/** Writes a `lost` movement and parks the asset in the terminal status. */
	async markAssetLost(
		assetId: string,
		organizationId: string,
		data: { notes?: string | null; at?: Date },
		actor: TAssetOperationActor,
		tx: TTx,
	): Promise<TAssetMovementSelect> {
		const at = data.at ?? new Date();
		const movement = await this.operations.createMovement(
			{
				organizationId,
				assetId,
				movementType: 'lost',
				movedAt: at,
				movedByUserId: actor.userId,
				notes: data.notes ?? null,
				createdAt: at,
			},
			tx,
		);
		await this.assetRepository.update(assetId, { status: 'lost' }, tx);
		return movement;
	}

	/**
	 * Places a ready asset into a warehouse storage, writing the `receipt`
	 * movement. The storage must belong to the warehouse (Inventory owns both).
	 */
	async place(
		assetId: string,
		organizationId: string,
		data: {
			warehouseId: string;
			storageId?: string | null;
			locationDescription?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetMovementSelect> {
		const asset = await this.requireAssetInScope(assetId, organizationId);
		if (asset.status !== 'ready') {
			throw new AssetRuleViolationError(
				`place_blocked:${asset.status}`,
				'assets.placeBlocked',
				`An asset in status "${asset.status}" cannot be placed`,
			);
		}
		await this.assertLocation(
			data.warehouseId,
			data.storageId ?? null,
			organizationId,
		);

		const now = new Date();
		const movement = await this.database.transaction(async (tx) => {
			const created = await this.operations.createMovement(
				{
					organizationId,
					assetId,
					movementType: 'receipt',
					toWarehouseId: data.warehouseId,
					toStorageId: data.storageId ?? null,
					toLocation: data.locationDescription ?? null,
					movedAt: now,
					movedByUserId: actor.userId,
					createdAt: now,
				},
				tx,
			);
			await this.assetRepository.update(
				assetId,
				{
					warehouseId: data.warehouseId,
					storageId: data.storageId ?? null,
					locationDescription:
						data.locationDescription ?? asset.locationDescription,
				},
				tx,
			);
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.placed',
			targetType: 'asset_movement',
			targetId: movement.id,
			organizationId,
			meta: {
				assetId,
				warehouseId: data.warehouseId,
				storageId: data.storageId ?? null,
			},
		});
		return movement;
	}

	/** Moves a ready asset to another warehouse/storage, clearing the source. */
	async transfer(
		assetId: string,
		organizationId: string,
		data: {
			toWarehouseId: string;
			toStorageId?: string | null;
			notes?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetMovementSelect> {
		const asset = await this.requireAssetInScope(assetId, organizationId);
		if (asset.status !== 'ready') {
			throw new AssetRuleViolationError(
				`transfer_blocked:${asset.status}`,
				'assets.transferBlocked',
				`An asset in status "${asset.status}" cannot be transferred`,
			);
		}
		await this.assertLocation(
			data.toWarehouseId,
			data.toStorageId ?? null,
			organizationId,
		);

		const now = new Date();
		const movement = await this.database.transaction(async (tx) => {
			const created = await this.operations.createMovement(
				{
					organizationId,
					assetId,
					movementType: 'transfer',
					fromWarehouseId: asset.warehouseId,
					fromStorageId: asset.storageId,
					toWarehouseId: data.toWarehouseId,
					toStorageId: data.toStorageId ?? null,
					movedAt: now,
					movedByUserId: actor.userId,
					notes: data.notes ?? null,
					createdAt: now,
				},
				tx,
			);
			await this.assetRepository.update(
				assetId,
				{
					warehouseId: data.toWarehouseId,
					storageId: data.toStorageId ?? null,
				},
				tx,
			);
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.transferred',
			targetType: 'asset_movement',
			targetId: movement.id,
			organizationId,
			meta: {
				assetId,
				fromWarehouseId: asset.warehouseId,
				toWarehouseId: data.toWarehouseId,
			},
		});
		return movement;
	}

	/** Inventory contract: the warehouse exists, is linked, and the storage belongs to it. */
	private async assertLocation(
		warehouseId: string,
		storageId: string | null,
		organizationId: string,
	): Promise<void> {
		const reachable = await this.warehouses.assertWarehouseReachableByOrg(
			warehouseId,
			organizationId,
		);
		// Unlinked is reported as not-found rather than forbidden, so a tenant
		// cannot probe which warehouse ids exist (ERP-0031 acceptance).
		if (!reachable) throw new WarehouseNotFoundError();
		if (storageId) {
			await this.warehouses.assertStorageInWarehouse(storageId, warehouseId);
		}
	}

	/* ============================= movements ============================= */

	listMovements(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetMovementSelect>> {
		return this.operations.listMovements(assetId, organizationId, page, limit);
	}

	/** Records a manual transfer/project-site movement (no status change). */
	async move(
		assetId: string,
		organizationId: string,
		data: {
			movementType: string;
			fromLocation?: string | null;
			toLocation?: string | null;
			notes?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetMovementSelect> {
		if (!MOVEMENT_TYPES_ASSET.includes(data.movementType as never)) {
			throw new AssetRuleViolationError(
				`unknown movement type "${data.movementType}"`,
			);
		}
		const asset = await this.requireAssetInScope(assetId, organizationId);

		const now = new Date();
		const movement = await this.operations.createMovement({
			organizationId,
			assetId,
			movementType: data.movementType,
			fromLocation: data.fromLocation ?? asset.locationDescription,
			toLocation: data.toLocation ?? null,
			movedAt: now,
			movedByUserId: actor.userId,
			notes: data.notes ?? null,
			createdAt: now,
		});
		if (data.toLocation && data.toLocation !== asset.locationDescription) {
			await this.assetRepository.update(assetId, {
				locationDescription: data.toLocation,
			});
		}
		await this.audit.record({
			actor,
			action: 'asset.moved',
			targetType: 'asset_movement',
			targetId: movement.id,
			organizationId,
			meta: { assetId, movementType: data.movementType, toLocation: data.toLocation ?? null },
		});
		return movement;
	}

	/* ========================== condition checks ========================= */

	async recordCondition(
		assetId: string,
		organizationId: string,
		data: {
			checkDate: string;
			condition: string;
			findings?: string | null;
			nextCheckDate?: string | null;
			status?: string;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetConditionCheckSelect> {
		if (!CONDITION_VALUES.includes(data.condition as never)) {
			throw new AssetRuleViolationError(
				`unknown condition "${data.condition}"`,
			);
		}
		if (
			data.status &&
			!CONDITION_CHECK_STATUSES.includes(data.status as never)
		) {
			throw new AssetRuleViolationError(`unknown check status "${data.status}"`);
		}
		await this.requireAssetInScope(assetId, organizationId);

		const now = new Date();
		const check = await this.database.transaction(async (tx) => {
			const created = await this.operations.createConditionCheck(
				{
					organizationId,
					assetId,
					checkDate: data.checkDate,
					condition: data.condition,
					findings: data.findings ?? null,
					checkedByUserId: actor.userId,
					nextCheckDate: data.nextCheckDate ?? null,
					status: data.status ?? 'recorded',
					createdAt: now,
				},
				tx,
			);
			// A condition check is evidence: the asset's current condition
			// follows the latest check in the same transaction.
			await this.assetRepository.update(
				assetId,
				{ condition: data.condition },
				tx,
			);
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.condition_recorded',
			targetType: 'asset_condition_check',
			targetId: check.id,
			organizationId,
			meta: { assetId, condition: data.condition },
		});
		return check;
	}

	listConditionChecks(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetConditionCheckSelect>> {
		return this.operations.listConditionChecks(assetId, organizationId, page, limit);
	}

	/* ============================ maintenances =========================== */

	/** Logs a service record; code minted via ERP-0009 (D15). */
	async logMaintenance(
		assetId: string,
		organizationId: string,
		data: {
			maintenanceType?: string;
			scheduledDate?: string | null;
			performedDate?: string | null;
			performedByEmployeeId?: string | null;
			vendorName?: string | null;
			cost?: number;
			currencyCode?: string;
			description?: string | null;
			status?: string;
			nextServiceDate?: string | null;
			documentId?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetMaintenanceSelect> {
		if (
			data.maintenanceType &&
			!MAINTENANCE_TYPES.includes(data.maintenanceType as never)
		) {
			throw new AssetRuleViolationError(
				`unknown maintenance type "${data.maintenanceType}"`,
			);
		}
		if (
			data.status &&
			!MAINTENANCE_STATUSES.includes(data.status as never)
		) {
			throw new AssetRuleViolationError(
				`unknown maintenance status "${data.status}"`,
			);
		}
		await this.requireAssetInScope(assetId, organizationId);

		const record = await this.database.transaction(async (tx) => {
			const code = await this.numbering.next(ASSET_DOC_TYPES.maintenance, { tx });
			return this.operations.createMaintenance(
				{
					organizationId,
					code,
					assetId,
					maintenanceType: data.maintenanceType ?? 'preventive',
					scheduledDate: data.scheduledDate ?? null,
					performedDate: data.performedDate ?? null,
					performedByEmployeeId: data.performedByEmployeeId ?? null,
					vendorName: data.vendorName ?? null,
					cost: data.cost ?? 0,
					currencyCode: data.currencyCode ?? 'IDR',
					description: data.description ?? null,
					status: data.status ?? 'scheduled',
					nextServiceDate: data.nextServiceDate ?? null,
					documentId: data.documentId ?? null,
					createdAt: new Date(),
				},
				tx,
			);
		});
		await this.audit.record({
			actor,
			action: 'asset.serviced',
			targetType: 'asset_maintenance',
			targetId: record.id,
			organizationId,
			meta: {
				assetId,
				code: record.code,
				maintenanceType: record.maintenanceType,
				cost: record.cost,
			},
		});
		return record;
	}

	listMaintenances(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetMaintenanceSelect>> {
		return this.operations.listMaintenances(assetId, organizationId, page, limit);
	}

	/* ============================ depreciations ========================== */

	/**
	 * D14: manual depreciation entry. Idempotent per (asset, period); the
	 * entry and the asset's book-value/accumulated-depreciation update share
	 * one transaction.
	 */
	async recordDepreciation(
		assetId: string,
		organizationId: string,
		data: {
			periodYear: number;
			periodMonth: number;
			depreciationAmount: number;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetDepreciationSelect> {
		if (
			!Number.isInteger(data.periodYear) ||
			!Number.isInteger(data.periodMonth) ||
			data.periodMonth < 1 ||
			data.periodMonth > 12
		) {
			throw new AssetRuleViolationError('invalid_period');
		}
		if (data.depreciationAmount < 0) {
			throw new AssetRuleViolationError('negative_depreciation');
		}

		const entry = await this.database.transaction(async (tx) => {
			const asset = await this.requireAsset(assetId);
			if (asset.organizationId !== organizationId) {
				throw new AssetNotFoundError();
			}
			const existing = await this.operations.findDepreciationPeriod(
				assetId,
				data.periodYear,
				data.periodMonth,
			);
			if (existing) {
				throw new AssetRuleViolationError(
					`period_already_depreciated:${data.periodYear}-${data.periodMonth}`,
					'assets.periodAlreadyDepreciated',
					'This asset already has a depreciation entry for this period',
				);
			}
			if (data.depreciationAmount > asset.bookValue) {
				throw new AssetRuleViolationError(
					'depreciation_exceeds_book_value',
					'assets.depreciationExceedsBookValue',
					'Depreciation cannot exceed the remaining book value',
				);
			}
			const closing = asset.bookValue - data.depreciationAmount;
			const created = await this.operations.createDepreciation(
				{
					organizationId,
					assetId,
					periodYear: data.periodYear,
					periodMonth: data.periodMonth,
					depreciationMethod: asset.depreciationMethod,
					depreciationAmount: data.depreciationAmount,
					openingBookValue: asset.bookValue,
					closingBookValue: closing,
					currencyCode: asset.currencyCode,
					calculatedAt: new Date(),
					createdAt: new Date(),
				},
				tx,
			);
			await this.assetRepository.update(
				assetId,
				{
					bookValue: closing,
					accumulatedDepreciation:
						asset.accumulatedDepreciation + data.depreciationAmount,
				},
				tx,
			);
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.depreciated',
			targetType: 'asset_depreciation',
			targetId: entry.id,
			organizationId,
			meta: {
				assetId,
				period: `${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}`,
				depreciationAmount: data.depreciationAmount,
				closingBookValue: entry.closingBookValue,
			},
		});
		return entry;
	}

	listDepreciations(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDepreciationSelect>> {
		return this.operations.listDepreciations(assetId, organizationId, page, limit);
	}

	/* ============================== disposals ============================ */

	/** D21: raises a disposal in `draft`; code minted via ERP-0009. */
	async requestDisposal(
		assetId: string,
		organizationId: string,
		data: {
			disposalDate?: string | null;
			disposalMethod?: string;
			proceedsAmount?: number;
			currencyCode?: string;
			buyerName?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetDisposalSelect> {
		if (
			data.disposalMethod &&
			!DISPOSAL_METHODS.includes(data.disposalMethod as never)
		) {
			throw new AssetRuleViolationError(
				`unknown disposal method "${data.disposalMethod}"`,
			);
		}
		const asset = await this.requireAssetInScope(assetId, organizationId);
		if (asset.status === 'disposed') {
			throw new AssetTransitionError(asset.status, 'disposal_requested');
		}

		const disposal = await this.database.transaction(async (tx) => {
			const code = await this.numbering.next(ASSET_DOC_TYPES.disposal, { tx });
			return this.operations.createDisposal(
				{
					organizationId,
					code,
					assetId,
					disposalDate: data.disposalDate ?? null,
					disposalMethod: data.disposalMethod ?? 'scrap',
					proceedsAmount: data.proceedsAmount ?? 0,
					currencyCode: data.currencyCode ?? asset.currencyCode,
					buyerName: data.buyerName ?? null,
					status: 'draft',
					requestedBy: actor.userId,
					createdAt: new Date(),
				},
				tx,
			);
		});
		await this.audit.record({
			actor,
			action: 'asset.disposal_requested',
			targetType: 'asset_disposal',
			targetId: disposal.id,
			organizationId,
			meta: { assetId, code: disposal.code, method: disposal.disposalMethod },
		});
		return disposal;
	}

	/** D21: `draft|submitted → approved`. */
	async approveDisposal(
		disposalId: string,
		organizationId: string,
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetDisposalSelect> {
		const disposal = await this.requireDisposal(disposalId, organizationId);
		if (!['draft', 'submitted'].includes(disposal.status)) {
			throw new AssetTransitionError(disposal.status, 'approved');
		}
		const updated = await this.operations.updateDisposal(disposalId, {
			status: 'approved',
			approvedBy: actor.userId,
			approvedAt: new Date(),
		});
		if (!updated) throw new AssetNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.disposal_approved',
			targetType: 'asset_disposal',
			targetId: disposalId,
			organizationId,
			meta: { code: disposal.code, from: disposal.status },
		});
		return updated;
	}

	/**
	 * D21: executes an approved disposal. The execution claim, the asset
	 * flip to `disposed` and the asset's soft delete share ONE transaction:
	 * of two concurrent executions exactly one wins, and the asset is never
	 * left half-disposed.
	 */
	async executeDisposal(
		disposalId: string,
		organizationId: string,
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetDisposalSelect> {
		const disposal = await this.requireDisposal(disposalId, organizationId);
		if (disposal.status !== 'approved') {
			throw new AssetTransitionError(disposal.status, 'executed');
		}

		const executed = await this.database.transaction(async (tx) => {
			const claimed = await this.operations.claimForExecution(disposalId, tx);
			if (!claimed) {
				throw new AssetRuleViolationError('disposal_already_executed');
			}
			const asset = await this.requireAsset(disposal.assetId);
			await this.assetRepository.update(
				disposal.assetId,
				{
					status: 'disposed',
					bookValue: 0,
				},
				tx,
			);
			// Soft delete the asset — the disposal record stays as the
			// financial proof (DBML note on asset_disposals).
			await this.assetRepository.archive(disposal.assetId, tx);
			void asset;
			return claimed;
		});
		await this.audit.record({
			actor,
			action: 'asset.disposal_executed',
			targetType: 'asset_disposal',
			targetId: disposalId,
			organizationId,
			meta: {
				assetId: disposal.assetId,
				code: disposal.code,
				proceedsAmount: disposal.proceedsAmount,
				bookValueAtDisposal: disposal.bookValueAtDisposal,
			},
		});
		return executed;
	}

	/** D21: any non-executed disposal can be cancelled. */
	async cancelDisposal(
		disposalId: string,
		organizationId: string,
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetDisposalSelect> {
		const disposal = await this.requireDisposal(disposalId, organizationId);
		if (disposal.status === 'executed') {
			throw new AssetTransitionError(disposal.status, 'cancelled');
		}
		const updated = await this.operations.updateDisposal(disposalId, {
			status: 'cancelled',
		});
		if (!updated) throw new AssetNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.disposal_cancelled',
			targetType: 'asset_disposal',
			targetId: disposalId,
			organizationId,
			meta: { code: disposal.code, from: disposal.status },
		});
		return updated;
	}

	listDisposals(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDisposalSelect>> {
		return this.operations.listDisposals(organizationId, page, limit);
	}

	async getDisposal(
		id: string,
		organizationId: string,
	): Promise<TAssetDisposalSelect> {
		return this.requireDisposal(id, organizationId);
	}

	/* ============================== documents ============================ */

	/** D19: logical document reference attach (no Documents module yet). */
	async attachDocument(
		assetId: string,
		organizationId: string,
		data: { documentId: string; documentType: string },
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetDocumentSelect> {
		if (!DOCUMENT_TYPES_ASSET.includes(data.documentType as never)) {
			throw new AssetRuleViolationError(
				`unknown document type "${data.documentType}"`,
			);
		}
		await this.requireAssetInScope(assetId, organizationId);
		const document = await this.operations.createDocument({
			organizationId,
			assetId,
			documentId: data.documentId,
			documentType: data.documentType,
			createdAt: new Date(),
		});
		await this.audit.record({
			actor,
			action: 'asset.updated',
			targetType: 'asset_document',
			targetId: document.id,
			organizationId,
			meta: { assetId, documentId: data.documentId, documentType: data.documentType },
		});
		return document;
	}

	listDocuments(
		assetId: string,
		organizationId: string,
	): Promise<TAssetDocumentSelect[]> {
		return this.operations.listDocuments(assetId, organizationId);
	}

	/* ============================== tool sets ============================ */

	async createToolSet(
		organizationId: string,
		data: {
			name: string;
			description?: string | null;
			custodianEmployeeId?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TToolSetSelect> {
		const created = await this.database.transaction(async (tx) => {
			const code = await this.numbering.next(ASSET_DOC_TYPES.toolSet, { tx });
			return this.operations.createToolSet(
				{
					organizationId,
					code,
					name: data.name,
					description: data.description ?? null,
					custodianEmployeeId: data.custodianEmployeeId ?? null,
					status: 'available',
					createdAt: new Date(),
				},
				tx,
			);
		});
		await this.audit.record({
			actor,
			action: 'asset.tool_set_created',
			targetType: 'tool_set',
			targetId: created.id,
			organizationId,
			meta: { code: created.code, name: created.name },
		});
		return created;
	}

	async getToolSet(
		id: string,
		organizationId: string,
	): Promise<TToolSetSelect & { items: TToolSetItemSelect[] }> {
		const toolSet = await this.operations.findToolSetById(id);
		if (!toolSet || toolSet.organizationId !== organizationId) {
			throw new AssetNotFoundError();
		}
		const items = await this.operations.listToolSetItems(id);
		return { ...toolSet, items };
	}

	listToolSets(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TToolSetSelect>> {
		return this.operations.listToolSets(organizationId, page, limit);
	}

	async updateToolSet(
		id: string,
		organizationId: string,
		data: {
			name?: string;
			description?: string | null;
			custodianEmployeeId?: string | null;
			status?: string;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TToolSetSelect> {
		const current = await this.operations.findToolSetById(id);
		if (!current || current.organizationId !== organizationId) {
			throw new AssetNotFoundError();
		}
		if (data.status && !TOOL_SET_STATUSES.includes(data.status as never)) {
			throw new AssetRuleViolationError(`unknown tool-set status "${data.status}"`);
		}
		const updated = await this.operations.updateToolSet(id, data);
		if (!updated) throw new AssetNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.tool_set_updated',
			targetType: 'tool_set',
			targetId: id,
			organizationId,
			meta: {
				code: current.code,
				...InventoryAuditWriter.snapshot(
					{ name: current.name, status: current.status },
					{ name: updated.name, status: updated.status },
				),
			},
		});
		return updated;
	}

	async archiveToolSet(
		id: string,
		organizationId: string,
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<void> {
		const current = await this.operations.findToolSetById(id);
		if (!current || current.organizationId !== organizationId) {
			throw new AssetNotFoundError();
		}
		const items = await this.operations.listToolSetItems(id);
		if (items.length > 0) {
			throw new AssetRuleViolationError(
				'tool_set_not_empty',
				'assets.toolSetNotEmpty',
				'Cannot archive a tool set that still holds items',
			);
		}
		await this.operations.archiveToolSet(id);
		await this.audit.record({
			actor,
			action: 'asset.tool_set_archived',
			targetType: 'tool_set',
			targetId: id,
			organizationId,
			meta: { code: current.code },
		});
	}

	/** D6: flips a kit's status inside the borrowing transaction. */
	async setToolSetStatus(
		id: string,
		status: 'lent' | 'available',
		tx?: TTx,
	): Promise<void> {
		await this.operations.updateToolSet(id, { status }, tx);
	}

	/** D6: the member assets of a kit, for borrowing expansion. */
	async toolSetAssetIds(
		toolSetId: string,
		organizationId: string,
	): Promise<string[]> {
		const set = await this.operations.findToolSetById(toolSetId);
		if (
			!set ||
			(set.organizationId !== null && set.organizationId !== organizationId)
		) {
			throw new AssetNotFoundError();
		}
		const items = await this.operations.listToolSetItems(toolSetId);
		return items.map((item) => item.assetId);
	}

	async addToolSetItem(
		toolSetId: string,
		organizationId: string,
		data: { assetId: string; quantity?: number },
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TToolSetItemSelect> {
		await this.requireAssetInScope(data.assetId, organizationId);
		const item = await this.operations.addToolSetItem({
			organizationId,
			toolSetId,
			assetId: data.assetId,
			quantity: String(data.quantity ?? 1),
			createdAt: new Date(),
		});
		await this.audit.record({
			actor,
			action: 'asset.tool_set_updated',
			targetType: 'tool_set',
			targetId: toolSetId,
			organizationId,
			meta: { itemAdded: data.assetId, quantity: data.quantity ?? 1 },
		});
		return item;
	}

	async removeToolSetItem(
		toolSetId: string,
		itemId: string,
		organizationId: string,
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<void> {
		const toolSet = await this.operations.findToolSetById(toolSetId);
		if (!toolSet || toolSet.organizationId !== organizationId) {
			throw new AssetNotFoundError();
		}
		const removed = await this.operations.removeToolSetItem(toolSetId, itemId);
		if (!removed) throw new AssetNotFoundError();
		await this.audit.record({
			actor,
			action: 'asset.tool_set_updated',
			targetType: 'tool_set',
			targetId: toolSetId,
			organizationId,
			meta: { itemRemoved: itemId },
		});
	}

	/* ============================== helpers ============================== */

	/** Loads an alive asset scoped to the caller's organization or throws. */
	private async requireAssetInScope(
		assetId: string,
		organizationId: string,
	) {
		const asset = await this.assetRepository.findById(assetId);
		if (!asset || asset.organizationId !== organizationId) {
			throw new AssetNotFoundError();
		}
		return asset;
	}

	private async requireAsset(assetId: string) {
		const asset = await this.assetRepository.findById(assetId);
		if (!asset) throw new AssetNotFoundError();
		return asset;
	}

	private async requireDisposal(id: string, organizationId: string) {
		const disposal = await this.operations.findDisposalById(id);
		if (!disposal || disposal.organizationId !== organizationId) {
			throw new AssetNotFoundError();
		}
		return disposal;
	}
}

// Re-exported for controller typing.
export { ASSET_STATUSES, DISPOSAL_STATUSES };
