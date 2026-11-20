import type {
	TConditionCheckSelect,
	TItemSelect,
	TMaintenanceSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { SYSTEM_AUDIT_ACTOR, type TInventoryAuditActor } from '../constants/audit-actor';
import {
	CONDITION_CHECK_REPOSITORY_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	MAINTENANCE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { TConditionCheckInput, TMaintenanceCreateInput } from '../contracts/item-operations.contract';
import type {
	IConditionCheckRepository,
	IMaintenanceRepository,
	TItemHistoryPaginationRequest,
} from '../contracts/item-operations.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import { ItemNotFoundError } from '../errors/item.errors';
import { InventoryAuditWriter } from './inventory-audit.writer';
import type { InventoryNumberingService } from './inventory-numbering.service';
import type { ItemCustodyService } from './item-custody.service';
import { ITEM_CUSTODY_SERVICE_TOKEN } from '../constants/di';

/**
 * Service history and condition checks of item units (was the maintenance and
 * condition half of `AssetOperationsService`).
 *
 * @remarks
 * A maintenance code comes from `InventoryNumberingService` inside the creating
 * transaction. A condition check is evidence: the unit's current `condition`
 * follows the latest check in the same transaction. Logging a scheduled or
 * in-progress maintenance reconciles the unit's status (`maintenance`).
 */
@injectable()
export class MaintenanceService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: Pick<IItemRepository, 'findById' | 'update'>,
		@inject(MAINTENANCE_REPOSITORY_TOKEN)
		private readonly maintenances: IMaintenanceRepository,
		@inject(CONDITION_CHECK_REPOSITORY_TOKEN)
		private readonly conditionChecks: IConditionCheckRepository,
		@inject(ITEM_CUSTODY_SERVICE_TOKEN)
		private readonly custody: Pick<ItemCustodyService, 'reconcileStatus'>,
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		private readonly audit: InventoryAuditWriter,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	/** Logs a service record and reconciles the unit's status. */
	async logMaintenance(
		itemId: string,
		organizationId: string,
		data: TMaintenanceCreateInput,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TMaintenanceSelect> {
		await this.requireItemInScope(itemId, organizationId);
		const record = await this.transactions.run(async (tx) => {
			const created = await this.maintenances.create(
				{
					organizationId,
					code: await this.numbering.next('maintenance', tx),
					itemId,
					maintenanceType: data.maintenanceType,
					scheduledDate: data.scheduledDate ?? null,
					performedDate: data.performedDate ?? null,
					performedByEmployeeId: data.performedByEmployeeId ?? null,
					vendorName: data.vendorName ?? null,
					cost: data.cost,
					currencyCode: data.currencyCode,
					description: data.description ?? null,
					status: data.status,
					nextServiceDate: data.nextServiceDate ?? null,
					documentId: data.documentId ?? null,
					createdAt: new Date(),
				},
				tx,
			);
			await this.custody.reconcileStatus(itemId, tx);
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.serviced',
			targetType: 'asset_maintenance',
			targetId: record.id,
			organizationId,
			meta: { itemId, code: record.code, maintenanceType: record.maintenanceType, cost: record.cost },
		});
		return record;
	}

	/** Fetches one page of the unit's service history. */
	listMaintenances(
		request: TItemHistoryPaginationRequest,
	): Promise<TPaginationResult<TMaintenanceSelect>> {
		return this.maintenances.paginateByItem(request);
	}

	/** Records a condition check; the unit's condition follows it. */
	async recordCondition(
		itemId: string,
		organizationId: string,
		data: TConditionCheckInput,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TConditionCheckSelect> {
		await this.requireItemInScope(itemId, organizationId);
		const check = await this.transactions.run(async (tx) => {
			const created = await this.conditionChecks.create(
				{
					organizationId,
					itemId,
					checkDate: data.checkDate,
					condition: data.condition,
					findings: data.findings ?? null,
					checkedByUserId: actor.userId,
					nextCheckDate: data.nextCheckDate ?? null,
					status: data.status ?? 'recorded',
					createdAt: new Date(),
				},
				tx,
			);
			await this.itemRepository.update(itemId, { condition: data.condition }, tx);
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.condition_recorded',
			targetType: 'asset_condition_check',
			targetId: check.id,
			organizationId,
			meta: { itemId, condition: data.condition },
		});
		return check;
	}

	/** Fetches one page of the unit's condition-check history. */
	listConditionChecks(
		request: TItemHistoryPaginationRequest,
	): Promise<TPaginationResult<TConditionCheckSelect>> {
		return this.conditionChecks.paginateByItem(request);
	}

	private async requireItemInScope(itemId: string, organizationId: string): Promise<TItemSelect> {
		const item = await this.itemRepository.findById(itemId);
		if (!item || item.organizationId !== organizationId) throw new ItemNotFoundError();
		return item;
	}
}
