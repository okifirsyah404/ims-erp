import type { ItemStatus, TItemSelect } from '@drizzle/schemas/inventory.schema';
import type { TTx } from '@drizzle/types';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import {
	BORROWING_ITEM_REPOSITORY_TOKEN,
	INVENTORY_NUMBERING_SERVICE_TOKEN,
	ITEM_MOVEMENT_REPOSITORY_TOKEN,
	ITEM_REPOSITORY_TOKEN,
	MAINTENANCE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IBorrowingItemRepository } from '../contracts/borrowing.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import type {
	IItemMovementRepository,
	TItemMovementSelect,
} from '../contracts/item-movement.repository.interface';
import type { IMaintenanceRepository, TItemHistoryPaginationRequest } from '../contracts/item-operations.repository.interface';
import { ItemNotFoundError, ItemRuleViolationError } from '../errors/item.errors';
import { InventoryReferenceError } from '../errors/inventory.errors';
import { AuditWriter, SYSTEM_AUDIT_ACTOR, type TAuditActor } from '@shared/audit';
import type { InventoryNumberingService } from './inventory-numbering.service';
import { EXPORTED_WAREHOUSE_SERVICE_TOKEN } from '@app/warehouse/constants/di';
import type { ExportedWarehouseService } from '@app/warehouse/services/exported-warehouse.service';

/**
 * Custody, location trail and derived status of item units (was the custody
 * half of `AssetOperationsService`).
 *
 * @remarks
 * Every movement is one row of `inventory.movements` with `item_id` set
 * (ADR-0024 Q24); its code is allocated inside the caller's transaction so a
 * rollback leaves no gap. Borrowing never writes the *product* ledger: item
 * rows are invisible to `StockService`.
 *
 * Status is derived from facts the module already records: `inactive` is
 * item-owned and sticky, `disposed`/`lost` are terminal, otherwise an open
 * borrowed item means `borrowed`, an unfinished maintenance `maintenance`,
 * and nothing open `ready`.
 */
@injectable()
export class ItemCustodyService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: IItemRepository,
		@inject(ITEM_MOVEMENT_REPOSITORY_TOKEN)
		private readonly movements: IItemMovementRepository,
		@inject(BORROWING_ITEM_REPOSITORY_TOKEN)
		private readonly borrowingItems: Pick<IBorrowingItemRepository, 'findOpenForItem'>,
		@inject(MAINTENANCE_REPOSITORY_TOKEN)
		private readonly maintenances: IMaintenanceRepository,
		@inject(INVENTORY_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<InventoryNumberingService, 'next'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: AuditWriter,
		/**
		 * Warehouse reachability and storage checks, read through the
		 * `warehouse` module's facade (ADR-0026): this module may not inject
		 * another module's service.
		 */
		@inject(EXPORTED_WAREHOUSE_SERVICE_TOKEN)
		private readonly warehouses: Pick<
			ExportedWarehouseService,
			'isLinked' | 'storageInWarehouse'
		>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
	) {}

	/** Derives the item's status from its open borrowing and maintenance. */
	async reconcileStatus(itemId: string, tx?: TTx): Promise<TItemSelect | null> {
		const item = await this.requireItem(itemId);
		if (['inactive', 'disposed', 'lost'].includes(item.status)) return item;
		const [open, maintenance] = await Promise.all([
			this.borrowingItems.findOpenForItem(itemId, tx),
			this.maintenances.hasOpenForItem(itemId, tx),
		]);
		const status: ItemStatus = open ? 'borrowed' : maintenance ? 'maintenance' : 'ready';
		if (status === item.status) return item;
		return this.itemRepository.update(itemId, { status }, tx);
	}

	/**
	 * Writes the custody snapshot: `borrowed_since` is the issue time of the
	 * open borrowed item, or NULL once nothing is out. The custodian employee
	 * is not derived (a borrower is a user, customer or guest, never an employee).
	 */
	async syncCustody(itemId: string, tx?: TTx): Promise<TItemSelect | null> {
		const open = await this.borrowingItems.findOpenForItem(itemId, tx);
		return this.itemRepository.update(itemId, { borrowedSince: open?.issuedAt ?? null }, tx);
	}

	/** `borrow_out` movement; the unit has no location while it is out. */
	async borrowOut(
		itemId: string,
		organizationId: string | null,
		data: {
			warehouseId: string;
			storageId: string | null;
			toLocation?: string | null;
			referenceId?: string | null;
			notes?: string | null;
			at?: Date;
		},
		actor: TAuditActor,
		tx: TTx,
	): Promise<TItemMovementSelect> {
		const movement = await this.record(
			{
				organizationId,
				itemId,
				movementType: 'borrow_out',
				warehouseId: data.warehouseId,
				binId: data.storageId,
				toLocation: data.toLocation ?? null,
				referenceType: 'borrowing',
				referenceId: data.referenceId ?? null,
				notes: data.notes ?? null,
				at: data.at,
			},
			actor,
			tx,
		);
		await this.itemRepository.update(itemId, { warehouseId: null, storageId: null }, tx);
		return movement;
	}

	/** `borrow_return` movement; restores the unit's location. */
	async borrowReturn(
		itemId: string,
		organizationId: string | null,
		data: {
			warehouseId: string;
			storageId: string | null;
			condition?: string | null;
			referenceId?: string | null;
			notes?: string | null;
			at?: Date;
		},
		actor: TAuditActor,
		tx: TTx,
	): Promise<TItemMovementSelect> {
		const movement = await this.record(
			{
				organizationId,
				itemId,
				movementType: 'borrow_return',
				targetWarehouseId: data.warehouseId,
				targetBinId: data.storageId,
				referenceType: 'borrowing',
				referenceId: data.referenceId ?? null,
				// `movements` has no condition column; the return condition is
				// kept in the note and on the borrowing item.
				notes: [data.condition ? `condition: ${data.condition}` : null, data.notes]
					.filter(Boolean)
					.join(' - ') || null,
				at: data.at,
			},
			actor,
			tx,
		);
		await this.itemRepository.update(
			itemId,
			{ warehouseId: data.warehouseId, storageId: data.storageId },
			tx,
		);
		return movement;
	}

	/** `lost` movement; parks the unit in the terminal status. */
	async markLost(
		itemId: string,
		organizationId: string | null,
		data: { referenceId?: string | null; notes?: string | null; at?: Date },
		actor: TAuditActor,
		tx: TTx,
	): Promise<TItemMovementSelect> {
		const movement = await this.record(
			{
				organizationId,
				itemId,
				movementType: 'lost',
				referenceType: 'borrowing',
				referenceId: data.referenceId ?? null,
				notes: data.notes ?? null,
				at: data.at,
			},
			actor,
			tx,
		);
		await this.itemRepository.update(itemId, { status: 'lost' }, tx);
		return movement;
	}

	/** Places a ready unit into a warehouse storage (`receipt` movement). */
	async place(
		itemId: string,
		organizationId: string,
		data: { warehouseId: string; storageId?: string | null; locationDescription?: string | null },
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemMovementSelect> {
		const item = await this.requireItemInScope(itemId, organizationId);
		this.assertReady(item, 'place');
		await this.assertLocation(data.warehouseId, data.storageId ?? null, organizationId);

		const movement = await this.transactions.run(async (tx) => {
			const created = await this.record(
				{
					organizationId,
					itemId,
					movementType: 'receipt',
					warehouseId: data.warehouseId,
					binId: data.storageId ?? null,
					toLocation: data.locationDescription ?? null,
				},
				actor,
				tx,
			);
			await this.itemRepository.update(
				itemId,
				{
					warehouseId: data.warehouseId,
					storageId: data.storageId ?? null,
					locationDescription: data.locationDescription ?? item.locationDescription,
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
			meta: { itemId, warehouseId: data.warehouseId, storageId: data.storageId ?? null },
		});
		return movement;
	}

	/** Moves a ready unit to another warehouse/storage (`transfer_out`, target set). */
	async transfer(
		itemId: string,
		organizationId: string,
		data: { toWarehouseId: string; toStorageId?: string | null; notes?: string | null },
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemMovementSelect> {
		const item = await this.requireItemInScope(itemId, organizationId);
		this.assertReady(item, 'transfer');
		await this.assertLocation(data.toWarehouseId, data.toStorageId ?? null, organizationId);

		const movement = await this.transactions.run(async (tx) => {
			const created = await this.record(
				{
					organizationId,
					itemId,
					movementType: 'transfer_out',
					warehouseId: item.warehouseId,
					binId: item.storageId,
					targetWarehouseId: data.toWarehouseId,
					targetBinId: data.toStorageId ?? null,
					notes: data.notes ?? null,
				},
				actor,
				tx,
			);
			await this.itemRepository.update(
				itemId,
				{ warehouseId: data.toWarehouseId, storageId: data.toStorageId ?? null },
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
			meta: { itemId, fromWarehouseId: item.warehouseId, toWarehouseId: data.toWarehouseId },
		});
		return movement;
	}

	/** Records a manual off-site move (`project_site`) without a status change. */
	async move(
		itemId: string,
		organizationId: string,
		data: {
			movementType: string;
			fromLocation?: string | null;
			toLocation?: string | null;
			notes?: string | null;
		},
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemMovementSelect> {
		if (data.movementType !== 'project_site') {
			throw new ItemRuleViolationError(`unknown movement type "${data.movementType}"`);
		}
		const item = await this.requireItemInScope(itemId, organizationId);
		const movement = await this.transactions.run(async (tx) => {
			const created = await this.record(
				{
					organizationId,
					itemId,
					movementType: 'project_site',
					fromLocation: data.fromLocation ?? item.locationDescription,
					toLocation: data.toLocation ?? null,
					notes: data.notes ?? null,
				},
				actor,
				tx,
			);
			if (data.toLocation && data.toLocation !== item.locationDescription) {
				await this.itemRepository.update(itemId, { locationDescription: data.toLocation }, tx);
			}
			return created;
		});
		await this.audit.record({
			actor,
			action: 'asset.moved',
			targetType: 'asset_movement',
			targetId: movement.id,
			organizationId,
			meta: { itemId, movementType: data.movementType, toLocation: data.toLocation ?? null },
		});
		return movement;
	}

	/** Fetches one page of the unit's location trail, newest first. */
	listMovements(
		request: TItemHistoryPaginationRequest,
	): Promise<TPaginationResult<TItemMovementSelect>> {
		return this.movements.paginateByItem(request);
	}

	/* ------------------------------------------------------------------ */

	/** Allocates the code and appends the item movement inside `tx`. */
	private async record(
		data: {
			organizationId: string | null;
			itemId: string;
			movementType: Parameters<IItemMovementRepository['create']>[0]['movementType'];
			warehouseId?: string | null;
			binId?: string | null;
			targetWarehouseId?: string | null;
			targetBinId?: string | null;
			fromLocation?: string | null;
			toLocation?: string | null;
			referenceType?: string | null;
			referenceId?: string | null;
			notes?: string | null;
			at?: Date;
		},
		actor: TAuditActor,
		tx: TTx,
	): Promise<TItemMovementSelect> {
		const { at, ...rest } = data;
		const occurredAt = at ?? new Date();
		return this.movements.create(
			{
				...rest,
				code: await this.numbering.next('stock_movement', tx, occurredAt),
				occurredAt,
				createdBy: actor.userId,
			},
			tx,
		);
	}

	private assertReady(item: TItemSelect, operation: 'place' | 'transfer'): void {
		if (item.status !== 'ready') {
			throw new ItemRuleViolationError(
				`${operation}_blocked:${item.status}`,
				operation === 'place' ? 'assets.placeBlocked' : 'assets.transferBlocked',
				`An item in status "${item.status}" cannot be ${operation === 'place' ? 'placed' : 'transferred'}`,
			);
		}
	}

	/** The warehouse exists, is linked to the organization, and the storage belongs to it. */
	private async assertLocation(
		warehouseId: string,
		storageId: string | null,
		organizationId: string,
	): Promise<void> {
		const reachable = await this.warehouses.isLinked(warehouseId, organizationId);
		// Unlinked is reported as not-found, so a tenant cannot probe which
		// warehouse ids exist (ERP-0031 acceptance).
		if (!reachable) throw new InventoryReferenceError('warehouse', 'warehouse.notFound');
		if (storageId) {
			const inWarehouse = await this.warehouses.storageInWarehouse(storageId, warehouseId);
			if (!inWarehouse) {
				throw new InventoryReferenceError('storage', 'warehouse.storageNotFound');
			}
		}
	}

	private async requireItem(itemId: string): Promise<TItemSelect> {
		const item = await this.itemRepository.findById(itemId);
		if (!item) throw new ItemNotFoundError();
		return item;
	}

	/** A global (organization-less) item is reachable by any tenant. */
	private async requireItemInScope(itemId: string, organizationId: string): Promise<TItemSelect> {
		const item = await this.requireItem(itemId);
		if (item.organizationId !== null && item.organizationId !== organizationId) {
			throw new ItemNotFoundError();
		}
		return item;
	}
}
