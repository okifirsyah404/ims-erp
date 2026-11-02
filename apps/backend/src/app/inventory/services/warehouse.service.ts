import { inject, injectable } from 'tsyringe';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	TWarehouseAddressSelect,
	TWarehouseSelect,
	TWarehouseStorageSelect,
} from '@drizzle/schemas/inventory.schema';
import type {
	IWarehouseRepository,
	TWarehouseCreateData,
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
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
} from '../constants/di';
import {
	InventoryRuleViolationError,
	StorageCodeTakenError,
	StorageNotFoundError,
	WarehouseCodeTakenError,
	WarehouseHasUnitsError,
	WarehouseNotFoundError,
} from './inventory.errors';

/** A warehouse with its 1:1 address and its bins. */
export type TWarehouseDetail = TWarehouseSelect & {
	address: TWarehouseAddressSelect | null;
	storages: TWarehouseStorageSelect[];
};

/** Input for updating a warehouse. `code`/`organizationId` already stripped. */
export type TWarehouseUpdateInput = {
	name?: string;
	responsibleEmployeeId?: string | null;
	isDefault?: boolean;
	isActive?: boolean;
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
	) {}

	/** Fetches one filtered page of warehouses. */
	paginate(request: {
		page: number;
		limit: number;
		search?: string;
		scope?: string;
		includeArchived?: boolean;
		isActive?: boolean;
	}): Promise<TPaginationResult<TWarehouseSelect>> {
		const { scope, ...rest } = request;
		return this.warehouseRepository.paginate({
			...rest,
			// `'global'` sentinel from the query string maps to the NULL scope;
			// absent means "every scope".
			organizationId: scope === undefined ? undefined : scope === 'global' ? null : scope,
		});
	}

	/**
	 * Fetches one warehouse with its address and storages.
	 *
	 * @param id - Warehouse id
	 * @throws {WarehouseNotFoundError} When absent or archived
	 */
	async getWarehouse(id: string): Promise<TWarehouseDetail> {
		const warehouse = await this.requireWarehouse(id);
		const [address, storages] = await Promise.all([
			this.addressRepository.findByWarehouseId(id),
			this.storageRepository.listByWarehouse(id),
		]);
		return { ...warehouse, address, storages };
	}

	/**
	 * Creates a warehouse, optionally with its address, in one transaction.
	 *
	 * @param input - Warehouse columns plus an optional nested address
	 * @throws {WarehouseCodeTakenError} When the code is taken in this scope
	 */
	async createWarehouse(
		input: TWarehouseCreateData,
	): Promise<TWarehouseDetail> {
		const organizationId = input.organizationId ?? null;

		const existing = await this.warehouseRepository.findByCode(
			organizationId,
			input.code,
		);
		if (existing) throw new WarehouseCodeTakenError();

		const warehouse = await this.warehouseRepository.create(input);

		// D-A: a warehouse created as the default demotes its siblings.
		if (warehouse.isDefault) {
			await this.warehouseRepository.clearDefaultExcept(
				organizationId,
				warehouse.id,
			);
		}

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
	async archiveWarehouse(id: string): Promise<TWarehouseSelect> {
		await this.requireWarehouse(id);

		const units = await this.warehouseRepository.countLiveUnits(id);
		if (units > 0) throw new WarehouseHasUnitsError(units);

		const archived = await this.warehouseRepository.archive(id);
		if (!archived) throw new WarehouseNotFoundError();
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
	): Promise<TWarehouseStorageSelect> {
		await this.requireWarehouse(warehouseId);

		const existing = await this.storageRepository.findByCode(
			warehouseId,
			input.code,
		);
		if (existing) throw new StorageCodeTakenError();

		return this.storageRepository.create({ ...input, warehouseId });
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
	): Promise<TWarehouseStorageSelect> {
		const storage = await this.requireStorage(warehouseId, storageId);
		const updated = await this.storageRepository.update(storage.id, input);
		if (!updated) throw new StorageNotFoundError();
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
	): Promise<TWarehouseStorageSelect> {
		const storage = await this.requireStorage(warehouseId, storageId);
		const archived = await this.storageRepository.archive(storage.id);
		if (!archived) throw new StorageNotFoundError();
		return archived;
	}

	/** Loads an alive warehouse or throws. */
	private async requireWarehouse(id: string): Promise<TWarehouseSelect> {
		const warehouse = await this.warehouseRepository.findById(id);
		if (!warehouse) throw new WarehouseNotFoundError();
		return warehouse;
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
