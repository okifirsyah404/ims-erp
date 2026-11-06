import { inject, injectable } from 'tsyringe';
import { InventoryAuditWriter } from './inventory-audit.writer';
import { SYSTEM_AUDIT_ACTOR } from '../constants/audit-actor';
import type { TInventoryAuditActor } from '../constants/audit-actor';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TWarehouseAddressSelect,
	TWarehouseSelect,
	TWarehouseStorageSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IWarehouseRepository,
	TWarehouseCreateData,
	TWarehouseKindCounts,
} from '../contracts/warehouse.repository.interface';
import type {
	IWarehouseAddressRepository,
	TWarehouseAddressUpsertData,
} from '../contracts/warehouse-address.repository.interface';
import type {
	IWarehouseStorageRepository,
	TWarehouseStorageCreateData,
	TWarehouseStorageUpdateData,
} from '../contracts/warehouse-storage.repository.interface';
import {
	WAREHOUSE_ADDRESS_REPOSITORY_TOKEN,
	WAREHOUSE_BORROWING_GUARD_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
} from '../constants/di';
import { EXPORTED_ASSET_SERVICE_TOKEN } from '@app/assets/constants/di';
import type { ExportedAssetService } from '@app/assets/services/exported-asset.service';import {
	InventoryRuleViolationError,
	StorageCodeTakenError,
	StorageNotFoundError,
	WarehouseCodeTakenError,
	WarehouseHasUnitsError,
	WarehouseInactiveError,
	WarehouseLinkConflictError,
	WarehouseNotFoundError,
} from '../errors/inventory.errors';
import type { IWarehouseBorrowingGuard } from '../contracts/warehouse-borrowing-guard.port';

/** A warehouse with its 1:1 address, its bins, and its kind counts. */
export type TWarehouseDetail = TWarehouseSelect & {
	address: TWarehouseAddressSelect | null;
	storages: TWarehouseStorageSelect[];
} & Omit<TWarehouseKindCounts, 'warehouseId'>;

/** A list-page warehouse row decorated with kind counts. */
export type TWarehouseWithCounts = TWarehouseSelect &
	Omit<TWarehouseKindCounts, 'warehouseId'>;

/** A warehouse linked to the caller's organization, with its bins (ERP-0031). */
export type TWarehouseLinked = TWarehouseSelect & {
	storages: TWarehouseStorageSelect[];
};

/** Input for updating a warehouse. `code`/`organizationId` already stripped. */
export type TWarehouseUpdateInput = {
	name?: string;
	responsibleEmployeeId?: string | null;
	isDefault?: boolean;
	isActive?: boolean;
	imageUrl?: string | null;
};

/**
 * Warehouse, address, and storage application service.
 *
 * @remarks
 * Owns the three rules the database cannot express on its own:
 *
 * 1. **At most one default per scope** (plan §6 D-A). `is_default` has a plain
 *    index, and a partial unique index cannot say "at most one `NULL` scope
 *    row" — so exclusivity is enforced here, in the same transaction as the
 *    write.
 * 2. **Scope is immutable after creation** (D-C). `organizationId` is never
 *    accepted on update; reassigning it would orphan live unit custody
 *    references and, once S3 lands, silently re-home stock balances.
 * 3. **Archive is guarded.** A warehouse still holding live serialized units
 *    cannot be archived, or those units would point at a dead row.
 *
 * Authorization is *not* checked here: warehouse routes are
 * application-admin-only at the guard level, so this service has no org
 * permission to consult.
 */
@injectable()
export class WarehouseService {
	constructor(
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouseRepository: IWarehouseRepository,
		@inject(WAREHOUSE_ADDRESS_REPOSITORY_TOKEN)
		private readonly addressRepository: IWarehouseAddressRepository,
		@inject(WAREHOUSE_STORAGE_REPOSITORY_TOKEN)
		private readonly storageRepository: IWarehouseStorageRepository,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: InventoryAuditWriter,
		/**
		 * Open-borrowing guard port (ERP-0031). Optional by token: `registerAssets`
		 * provides the real implementation; tests and asset-less compositions
		 * register a noop.
		 */
		@inject(WAREHOUSE_BORROWING_GUARD_TOKEN)
		private readonly borrowingGuard: IWarehouseBorrowingGuard,
		/** Equipment counts come from the assets module via its export facade. */
		@inject(EXPORTED_ASSET_SERVICE_TOKEN)
		private readonly exportedAssetService: ExportedAssetService,	) {}

	/** Fetches one filtered page of warehouses, decorated with kind counts. */
	async paginate(request: {
		page: number;
		limit: number;
		search?: string;
		scope?: string;
		includeArchived?: boolean;
		isActive?: boolean;
	}): Promise<TPaginationResult<TWarehouseWithCounts>> {
		const { scope, ...rest } = request;
		const result = await this.warehouseRepository.paginate({
			...rest,
			// `'global'` sentinel from the query string maps to the NULL scope;
			// absent means "every scope".
			organizationId: scope === undefined ? undefined : scope === 'global' ? null : scope,
		});
		const counts = await this.warehouseRepository.countKinds(
			result.data.map((warehouse) => warehouse.id),
		);
		const decorated = await this.withEquipmentCounts(counts);
		const byWarehouse = new Map(decorated.map((row) => [row.warehouseId, row]));
		return {
			...result,
			data: result.data.map((warehouse) => ({
				...warehouse,
				...byWarehouse.get(warehouse.id)!,
			})),
		};
	}

	/**
	 * Fetches one warehouse with its address and storages.
	 *
	 * @param id - Warehouse id
	 * @throws {WarehouseNotFoundError} When absent or archived
	 */
	async getWarehouse(id: string): Promise<TWarehouseDetail> {
		const warehouse = await this.requireWarehouse(id);
		const [address, storages, [counts]] = await Promise.all([
			this.addressRepository.findByWarehouseId(id),
			this.storageRepository.listByWarehouse(id),
			this.warehouseRepository.countKinds([id]),
		]);
		const [decorated] = await this.withEquipmentCounts([counts]);
		return {
			...warehouse,
			address,
			storages,
			productsCount: decorated.productsCount,
			materialsCount: decorated.materialsCount,
			equipmentsCount: decorated.equipmentsCount,
			storagesCount: decorated.storagesCount,
		};
	}

	/**
	 * Resolves alive warehouse names for the given ids.
	 *
	 * @remarks
	 * Published for cross-module decoration (e.g. the assets module showing
	 * where an asset is stored) — consumed via {@link WAREHOUSE_SERVICE_TOKEN}
	 * as a service-to-service call. Unknown or archived ids are simply absent
	 * from the returned map.
	 */
	async getNameMap(
		ids: string[],
	): Promise<Map<string, string>> {
		const rows = await this.warehouseRepository.findNamesByIds(ids);
		return new Map(rows.map((row) => [row.id, row.name]));
	}

	/**
	 * Merges alive equipment-asset counts (from the assets module) into the
	 * inventory-computed kind counts, per warehouse.
	 *
	 * @remarks
	 * Equipment is an asset (`assets.assets`, `assetType = 'equipment'`), not an
	 * inventory item kind, so the count crosses the module boundary as a
	 * service-to-service call per the module rules — the inventory module never
	 * queries the assets schema directly.
	 */
	private async withEquipmentCounts(
		counts: TWarehouseKindCounts[],
	): Promise<TWarehouseKindCounts[]> {
		if (counts.length === 0) return [];
		const warehouseIds = counts.map((row) => row.warehouseId);
		const equipmentRows = await this.exportedAssetService.countByWarehouse(
			warehouseIds,
			'equipment',
		);
		const equipmentByWarehouse = new Map(
			equipmentRows.flatMap((row) =>
				row.warehouseId === null ? [] : [[row.warehouseId, row.value]],
			),
		);
		return counts.map((row) => ({
			...row,
			equipmentsCount: equipmentByWarehouse.get(row.warehouseId) ?? 0,
		}));
	}

	/**
	 * Creates a warehouse, optionally with its address, in one transaction.
	 *
	 * @param input - Warehouse columns plus an optional nested address
	 * @throws {WarehouseCodeTakenError} When the code is taken in this scope
	 */
	async createWarehouse(
		input: TWarehouseCreateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseDetail> {
		// ERP-0031 (D1): every warehouse is global; organization access comes
		// from `warehouse_organizations` links, so a client-supplied scope is
		// dropped rather than stored. The column is frozen at NULL.
		const organizationId = null;

		const existing = await this.warehouseRepository.findByCode(
			organizationId,
			input.code,
		);
		if (existing) throw new WarehouseCodeTakenError();

		const warehouse = await this.warehouseRepository.create({
			...input,
			organizationId: null,
		});

		// D-A: a warehouse created as the default demotes its siblings.
		if (warehouse.isDefault) {
			await this.warehouseRepository.clearDefaultExcept(
				organizationId,
				warehouse.id,
			);
		}

		await this.audit.record({
			actor,
			action: 'warehouse.created',
			targetType: 'warehouse',
			targetId: warehouse.id,
			organizationId: warehouse.organizationId,
			meta: { code: warehouse.code, name: warehouse.name, isDefault: warehouse.isDefault },
		});

		return this.getWarehouse(warehouse.id);
	}

	/**
	 * Applies a partial update to a warehouse.
	 *
	 * @param id - Warehouse id
	 * @param input - Changed columns (never `code` or `organizationId`)
	 * @throws {WarehouseNotFoundError} When absent or archived
	 */
	async updateWarehouse(
		id: string,
		input: TWarehouseUpdateInput,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseDetail> {
		const current = await this.requireWarehouse(id);
		const updated = await this.warehouseRepository.update(id, input);
		if (!updated) throw new WarehouseNotFoundError();

		// D-A: promoting a warehouse to default demotes its siblings *in the
		// same scope*. Demoting (`false`) is always allowed and promotes
		// nothing — silently picking a replacement would be a guess.
		if (input.isDefault === true) {
			await this.warehouseRepository.clearDefaultExcept(
				current.organizationId,
				id,
			);
		}

		await this.audit.record({
			actor,
			action: 'warehouse.updated',
			targetType: 'warehouse',
			targetId: id,
			organizationId: updated.organizationId,
			meta: InventoryAuditWriter.snapshot(
				{
					name: current.name,
					responsibleEmployeeId: current.responsibleEmployeeId,
					isDefault: current.isDefault,
					isActive: current.isActive,
					imageUrl: current.imageUrl,
				},
				{
					name: updated.name,
					responsibleEmployeeId: updated.responsibleEmployeeId,
					isDefault: updated.isDefault,
					isActive: updated.isActive,
					imageUrl: updated.imageUrl,
				},
			),
		});

		return this.getWarehouse(id);
	}

	/**
	 * Soft-deletes a warehouse.
	 *
	 * @remarks
	 * Archiving the current default deliberately leaves the scope with **no**
	 * default rather than promoting another warehouse: promotion would be an
	 * arbitrary choice, and S3/S4 callers must treat "default" as nullable
	 * anyway.
	 *
	 * @param id - Warehouse id
	 * @returns The archived warehouse row
	 * @throws {WarehouseNotFoundError} When absent or archived
	 * @throws {WarehouseHasUnitsError} When live units still reference it
	 */
	async archiveWarehouse(
		id: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseSelect> {
		const current = await this.requireWarehouse(id);

		const units = await this.warehouseRepository.countLiveUnits(id);
		if (units > 0) throw new WarehouseHasUnitsError(units);

		const archived = await this.warehouseRepository.archive(id);
		if (!archived) throw new WarehouseNotFoundError();
		await this.audit.record({
			actor,
			action: 'warehouse.archived',
			targetType: 'warehouse',
			targetId: id,
			organizationId: archived.organizationId,
			meta: { code: archived.code, name: current.name },
		});
		return archived;
	}

	/**
	 * Creates or replaces a warehouse's single address.
	 *
	 * @param id - Warehouse id
	 * @param input - Address columns
	 * @throws {WarehouseNotFoundError} When the warehouse is absent
	 */
	async upsertAddress(
		id: string,
		input: TWarehouseAddressUpsertData,
	): Promise<TWarehouseAddressSelect> {
		await this.requireWarehouse(id);
		return this.addressRepository.upsert(id, input);
	}

	/**
	 * Removes a warehouse's address.
	 *
	 * @remarks
	 * Idempotent: removing an address that is not there is a success with
	 * `false`, not a 404. The address is a 1:1 child, so "already absent" is
	 * the caller's desired end state either way.
	 *
	 * @param id - Warehouse id
	 * @returns Whether an address was actually removed
	 * @throws {WarehouseNotFoundError} When the warehouse is absent
	 */
	async removeAddress(id: string): Promise<boolean> {
		await this.requireWarehouse(id);
		return this.addressRepository.remove(id);
	}

	/** Lists a warehouse's storages. */
	async listStorages(
		warehouseId: string,
		options?: { includeArchived?: boolean },
	): Promise<TWarehouseStorageSelect[]> {
		await this.requireWarehouse(warehouseId);
		return this.storageRepository.listByWarehouse(warehouseId, options);
	}

	/**
	 * Adds a storage (bin) to a warehouse.
	 *
	 * @param warehouseId - Owning warehouse
	 * @param input - Storage columns
	 * @throws {WarehouseNotFoundError} When the warehouse is absent
	 * @throws {StorageCodeTakenError} When the code is taken in this warehouse
	 */
	async createStorage(
		warehouseId: string,
		input: Omit<TWarehouseStorageCreateData, 'warehouseId' | 'createdAt'>,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseStorageSelect> {
		const warehouse = await this.requireWarehouse(warehouseId);
		this.requireActiveWarehouse(warehouse);

		const existing = await this.storageRepository.findByCode(
			warehouseId,
			input.code,
		);
		if (existing) throw new StorageCodeTakenError();

		const storage = await this.storageRepository.create({ ...input, warehouseId });
		await this.audit.record({
			actor,
			action: 'storage.created',
			targetType: 'warehouse_storage',
			targetId: storage.id,
			organizationId: warehouse.organizationId,
			meta: { warehouseId, code: storage.code, name: storage.name },
		});
		return storage;
	}

	/**
	 * Updates a storage.
	 *
	 * @param warehouseId - Owning warehouse
	 * @param storageId - Storage id
	 * @param input - Changed columns (never `code`)
	 * @throws {StorageNotFoundError} When the storage is absent from the warehouse
	 */
	async updateStorage(
		warehouseId: string,
		storageId: string,
		input: TWarehouseStorageUpdateData,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseStorageSelect> {
		const warehouse = await this.requireWarehouse(warehouseId);
		this.requireActiveWarehouse(warehouse);
		const storage = await this.requireStorage(warehouseId, storageId);
		const updated = await this.storageRepository.update(storage.id, input);
		if (!updated) throw new StorageNotFoundError();
		await this.audit.record({
			actor,
			action: 'storage.updated',
			targetType: 'warehouse_storage',
			targetId: storage.id,
			organizationId: warehouse.organizationId,
			meta: InventoryAuditWriter.snapshot(
				{ name: storage.name, binType: storage.binType, capacity: storage.capacity, isActive: storage.isActive },
				{ name: updated.name, binType: updated.binType, capacity: updated.capacity, isActive: updated.isActive },
			),
		});
		return updated;
	}

	/**
	 * Soft-deletes a storage.
	 *
	 * @param warehouseId - Owning warehouse
	 * @param storageId - Storage id
	 * @returns The archived storage row
	 * @throws {StorageNotFoundError} When the storage is absent from the warehouse
	 */
	async archiveStorage(
		warehouseId: string,
		storageId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseStorageSelect> {
		const warehouse = await this.requireWarehouse(warehouseId);
		const storage = await this.requireStorage(warehouseId, storageId);
		const archived = await this.storageRepository.archive(storage.id);
		if (!archived) throw new StorageNotFoundError();
		await this.audit.record({
			actor,
			action: 'storage.archived',
			targetType: 'warehouse_storage',
			targetId: storage.id,
			organizationId: warehouse.organizationId,
			meta: { warehouseId, code: storage.code },
		});
		return archived;
	}

	/** Loads an alive warehouse or throws. */
	private async requireWarehouse(id: string): Promise<TWarehouseSelect> {
		const warehouse = await this.warehouseRepository.findById(id);
		if (!warehouse) throw new WarehouseNotFoundError();
		return warehouse;
	}

	/**
	 * Asserts a storage belongs to a warehouse.
	 *
	 * @param storageId - Storage (bin) id
	 * @param warehouseId - Expected parent warehouse
	 * @throws {StorageNotFoundError} When either row is absent in this pairing
	 * @remarks
	 * Cross-module contract method: Assets owns the asset rows but never reads
	 * Inventory tables, so it validates locations through this port.
	 */
	async assertStorageInWarehouse(
		storageId: string,
		warehouseId: string,
	): Promise<void> {
		await this.requireStorage(warehouseId, storageId);
	}

	/**
	 * Whether a warehouse is reachable from an organization (ERP-0031).
	 *
	 * @param warehouseId - Warehouse id
	 * @param organizationId - Caller's tenant
	 * @returns `true` when reachable; the caller turns a `false` into its own
	 *   not-found semantics
	 * @throws {WarehouseNotFoundError} When the warehouse does not exist
	 * @remarks
	 * A warehouse is reachable when an alive `warehouse_organizations` link
	 * exists. The global-admin bypass lives at the controller/service boundary
	 * that knows the caller's platform role, not here: this port only answers
	 * the link question so the assets module can compose it with its own rules.
	 */
	async assertWarehouseReachableByOrg(
		warehouseId: string,
		organizationId: string,
	): Promise<boolean> {
		await this.requireWarehouse(warehouseId);
		return this.warehouseRepository.isLinked(warehouseId, organizationId);
	}

	/**
	 * Warehouses the active organization is linked to, each with its bins
	 * (ERP-0031).
	 *
	 * @remarks
	 * Storages ride along because the member-facing pickers (asset
	 * place/transfer, stock operations) choose a bin; a separate
	 * warehouse-detail call would hit the admin-only route.
	 *
	 * ponytail: one storage query per linked warehouse. A tenant links a
	 * handful, not hundreds — batch it if that ever changes.
	 *
	 * @param organizationId - The caller's validated tenant from `erp`
	 */
	async listLinkedWarehouses(
		organizationId: string,
	): Promise<TWarehouseLinked[]> {
		const rows = await this.warehouseRepository.listLinked(organizationId);
		return Promise.all(
			rows.map(async (warehouse) => ({
				...warehouse,
				storages: await this.storageRepository.listByWarehouse(warehouse.id),
			})),
		);
	}

	/**
	 * Organizations linked to one warehouse (ERP-0031, admin view).
	 *
	 * @param warehouseId - Warehouse id
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 */
	async listWarehouseOrganizations(warehouseId: string): Promise<
		Array<{ organizationId: string; createdAt: Date }>
	> {
		await this.requireWarehouse(warehouseId);
		return this.warehouseRepository.listOrganizations(warehouseId);
	}

	/**
	 * Grants one organization access to a warehouse (ERP-0031, admin-only).
	 *
	 * @remarks
	 * Idempotent: linking an already-linked pair is a success (audit records
	 * `created: false` so the ledger distinguishes a real grant from a retry).
	 *
	 * @param warehouseId - Warehouse id
	 * @param organizationId - Organization to grant
	 * @param actor - The acting global admin
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 */
	async linkOrganization(
		warehouseId: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<{ created: boolean }> {
		await this.requireWarehouse(warehouseId);
		const result = await this.warehouseRepository.linkOrganization(
			warehouseId,
			organizationId,
		);
		await this.audit.record({
			actor,
			action: 'warehouse.linked',
			targetType: 'warehouse',
			targetId: warehouseId,
			organizationId,
			meta: { organizationId, created: result.created },
		});
		return result;
	}

	/**
	 * Revokes one organization's access to a warehouse (ERP-0031, admin-only).
	 *
	 * @throws {WarehouseNotFoundError} When the warehouse is absent
	 * @throws {WarehouseLinkConflictError} While the organization holds open
	 *   borrowings originating in this warehouse — cutting the link would
	 *   strand custody that can no longer be returned.
	 */
	async unlinkOrganization(
		warehouseId: string,
		organizationId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<{ removed: boolean }> {
		await this.requireWarehouse(warehouseId);
		const openBorrowings = await this.borrowingGuard.countOpenBorrowings(
			warehouseId,
			organizationId,
		);
		if (openBorrowings > 0) throw new WarehouseLinkConflictError(openBorrowings);

		const removed = await this.warehouseRepository.unlinkOrganization(
			warehouseId,
			organizationId,
		);
		if (removed) {
			await this.audit.record({
				actor,
				action: 'warehouse.unlinked',
				targetType: 'warehouse',
				targetId: warehouseId,
				organizationId,
				meta: { organizationId },
			});
		}
		return { removed };
	}

	/**
	 * Rejects storage writes into an inactive warehouse.
	 *
	 * @remarks
	 * An inactive warehouse is read-only for logistics: units may still be
	 * moved *out* of it elsewhere, but no new bin may appear and no bin may be
	 * edited, or the warehouse would silently keep absorbing stock while
	 * marked closed. Archiving an existing storage remains allowed — removing
	 * capacity from a closed warehouse is the safe direction.
	 *
	 * @param warehouse - The parent warehouse row
	 * @throws {WarehouseInactiveError} When `isActive` is false
	 */
	private requireActiveWarehouse(warehouse: TWarehouseSelect): void {
		if (!warehouse.isActive) throw new WarehouseInactiveError(warehouse.code);
	}

	/**
	 * Loads an alive storage **scoped to its warehouse**.
	 *
	 * @remarks
	 * The warehouse check matters: without it, a storage id from another
	 * warehouse would be updatable through any warehouse path.
	 */
	private async requireStorage(
		warehouseId: string,
		storageId: string,
	): Promise<TWarehouseStorageSelect> {
		await this.requireWarehouse(warehouseId);

		const storage = await this.storageRepository.findById(storageId);
		if (!storage || storage.warehouseId !== warehouseId) {
			throw new StorageNotFoundError();
		}
		return storage;
	}
}

/**
 * Asserts a warehouse code is unchanged.
 *
 * @remarks
 * `code` is immutable after creation (it is the human-facing identifier other
 * modules reference logically). The update schema already rejects the field as
 * an unknown key; this exists for callers that bypass schema parsing.
 *
 * @param current - Current code
 * @param requested - Requested code, if any
 * @throws {InventoryRuleViolationError} When a change is attempted
 */
export function assertCodeUnchanged(
	current: string,
	requested: string | undefined,
): void {
	if (requested !== undefined && requested !== current) {
		throw new InventoryRuleViolationError(
			'A warehouse code cannot be changed after creation',
		);
	}
}
