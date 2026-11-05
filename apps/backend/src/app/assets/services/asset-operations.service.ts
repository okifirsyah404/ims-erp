import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TAssetAssignmentSelect,
	TAssetConditionCheckSelect,
	TAssetDepreciationSelect,
	TAssetDisposalSelect,
	TAssetDocumentSelect,
	TAssetMaintenanceSelect,
	TAssetMovementSelect,
	TToolSetItemSelect,
	TToolSetSelect,
} from '@drizzle/schemas/asset.schema';
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
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { DocumentNumberingService } from '@app/organization/services/document-numbering.service';
import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { ASSET_REPOSITORY_TOKEN, ASSET_OPERATIONS_REPOSITORY_TOKEN } from '../constants/di';
import type { IAssetRepository } from '../contracts/asset.repository.interface';
import type {
	IAssetOperationsRepository,
	TAssignmentListRequest,
} from '../contracts/asset-operations.repository.interface';
import { ASSET_DOC_TYPES } from '../constants/doc-types';
import {
	AssetNotFoundError,
	AssetRuleViolationError,
	AssetTransitionError,
} from '../errors/asset.errors';
import { InventoryAuditWriter } from '../../inventory/services/inventory-audit.writer';
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
		@inject(DOCUMENT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: DocumentNumberingService,
		/** Fire-and-forget audit writer, shared with the inventory module. */
		private readonly audit: InventoryAuditWriter,
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/* =============================== custody ============================= */

	/**
	 * D12: assigns an asset to a holder. Guards: the asset must not be
	 * `borrowed`/`inactive`/`disposed`/`lost`, and no open assignment may
	 * exist. Flips the asset to `borrowed` and writes a `borrow_out` movement in
	 * the same transaction.
	 */
	async assign(
		assetId: string,
		organizationId: string,
		data: {
			assignedToEmployeeId?: string | null;
			assignedToUserId?: string | null;
			conditionOnAssign?: string | null;
			notes?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetAssignmentSelect> {
		if (!data.assignedToEmployeeId && !data.assignedToUserId) {
			throw new AssetRuleViolationError('assignment_needs_holder');
		}
		if (
			data.conditionOnAssign &&
			!CONDITION_VALUES.includes(data.conditionOnAssign as never)
		) {
			throw new AssetRuleViolationError(
				`unknown condition "${data.conditionOnAssign}"`,
			);
		}

		const assignment = await this.database.transaction(async (tx) => {
			const asset = await this.requireAsset(assetId);
			if (asset.organizationId !== organizationId) {
				throw new AssetNotFoundError();
			}
			if (['borrowed', 'inactive', 'disposed', 'lost'].includes(asset.status)) {
				throw new AssetRuleViolationError(
					`assign_blocked:${asset.status}`,
					'assets.assignBlocked',
					`An asset in status "${asset.status}" cannot be assigned`,
				);
			}
			const open = await this.operations.findOpenAssignment(assetId, tx);
			if (open) {
				throw new AssetRuleViolationError('assignment_already_open');
			}

			const now = new Date();
			const created = await this.operations.createAssignment(
				{
					organizationId,
					assetId,
					assignedToEmployeeId: data.assignedToEmployeeId ?? null,
					assignedToUserId: data.assignedToUserId ?? null,
					conditionOnAssign: data.conditionOnAssign ?? null,
					notes: data.notes ?? null,
					assignedAt: now,
					createdAt: now,
				},
				tx,
			);
			await this.assetRepository.update(
				assetId,
				{ status: 'borrowed', borrowedSince: now },
				tx,
			);
			await this.operations.createMovement(
				{
					organizationId,
					assetId,
					movementType: 'borrow_out',
					fromLocation: asset.locationDescription,
					toLocation: asset.locationDescription,
					movedAt: now,
					movedByUserId: actor.userId,
					condition: data.conditionOnAssign ?? null,
					notes: data.notes ?? null,
					createdAt: now,
				},
				tx,
			);
			return created;
		});

		await this.audit.record({
			actor,
			action: 'asset.assigned',
			targetType: 'asset_assignment',
			targetId: assignment.id,
			organizationId,
			meta: {
				assetId,
				assignedToUserId: data.assignedToUserId ?? null,
				assignedToEmployeeId: data.assignedToEmployeeId ?? null,
				conditionOnAssign: data.conditionOnAssign ?? null,
			},
		});
		return assignment;
	}

	/**
	 * D12: returns an assigned asset. The open assignment is claimed with a
	 * conditional update (one concurrent return wins); condition-in is
	 * mandatory and updates the asset's condition. Flips the asset back to
	 * `ready` and writes a `borrow_return` movement in the same transaction.
	 */
	async returnAsset(
		assetId: string,
		organizationId: string,
		data: {
			conditionOnReturn: string;
			notes?: string | null;
		},
		actor: TAssetOperationActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TAssetAssignmentSelect> {
		if (!CONDITION_VALUES.includes(data.conditionOnReturn as never)) {
			throw new AssetRuleViolationError(
				`unknown condition "${data.conditionOnReturn}"`,
			);
		}

		const returned = await this.database.transaction(async (tx) => {
			const asset = await this.requireAsset(assetId);
			if (asset.organizationId !== organizationId) {
				throw new AssetNotFoundError();
			}
			if (asset.status !== 'borrowed') {
				throw new AssetTransitionError(asset.status, 'ready');
			}
			const open = await this.operations.findOpenAssignment(assetId, tx);
			if (!open) throw new AssetRuleViolationError('assignment_none_open');

			const now = new Date();
			const claimed = await this.operations.claimForReturn(
				open.id,
				{
					returnedAt: now,
					conditionOnReturn: data.conditionOnReturn,
					notes: data.notes ?? null,
				},
				tx,
			);
			if (!claimed) {
				// A concurrent return won the claim.
				throw new AssetRuleViolationError('assignment_already_returned');
			}
			await this.assetRepository.update(
				assetId,
				{ status: 'ready', borrowedSince: null, condition: data.conditionOnReturn },
				tx,
			);
			await this.operations.createMovement(
				{
					organizationId,
					assetId,
					movementType: 'borrow_return',
					toLocation: asset.locationDescription,
					movedAt: now,
					movedByUserId: actor.userId,
					condition: data.conditionOnReturn,
					notes: data.notes ?? null,
					createdAt: now,
				},
				tx,
			);
			return claimed;
		});

		await this.audit.record({
			actor,
			action: 'asset.returned',
			targetType: 'asset_assignment',
			targetId: returned.id,
			organizationId,
			meta: {
				assetId,
				conditionOnReturn: data.conditionOnReturn,
				notes: data.notes ?? null,
			},
		});
		return returned;
	}

	listAssignments(
		request: TAssignmentListRequest,
	): Promise<TPaginationResult<TAssetAssignmentSelect>> {
		return this.operations.listAssignments(request);
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
			const number = await this.numbering.allocate(
				organizationId,
				ASSET_DOC_TYPES.maintenance,
				tx,
			);
			return this.operations.createMaintenance(
				{
					organizationId,
					code: this.numbering.format('MNT', 'SVC', number, 5),
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
			const number = await this.numbering.allocate(
				organizationId,
				ASSET_DOC_TYPES.disposal,
				tx,
			);
			return this.operations.createDisposal(
				{
					organizationId,
					code: this.numbering.format('DSP', 'DSL', number, 5),
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
			const number = await this.numbering.allocate(
				organizationId,
				ASSET_DOC_TYPES.asset,
				tx,
			);
			return this.operations.createToolSet(
				{
					organizationId,
					code: this.numbering.format('TST', 'KIT', number, 5),
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
