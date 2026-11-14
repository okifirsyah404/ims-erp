import { inject, injectable } from 'tsyringe';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { SYSTEM_AUDIT_ACTOR } from '../constants/audit-actor';
import type { TInventoryAuditActor } from '../constants/audit-actor';
import type {
	TWarehouseManagerSelect,
	TWarehouseSelect,
	TWarehouseStorageSelect,
} from '@drizzle/schemas/inventory.schema';
import {
	WAREHOUSE_MANAGER_REPOSITORY_TOKEN,
	WAREHOUSE_REPOSITORY_TOKEN,
	WAREHOUSE_STORAGE_REPOSITORY_TOKEN,
} from '../constants/di';
import type { IWarehouseManagerRepository } from '../contracts/warehouse-manager.repository.interface';
import type { IWarehouseRepository } from '../contracts/warehouse.repository.interface';
import type { IWarehouseStorageRepository } from '../contracts/warehouse-storage.repository.interface';
import {
	WarehouseManagerExistsError,
	WarehouseManagerUserNotFoundError,
	WarehouseNotFoundError,
} from '../errors/inventory.errors';
import { InventoryAuditWriter } from './inventory-audit.writer';

/** A warehouse the caller manages, with its bins (ADR-0017, `GET /warehouses/mine`). */
export type TWarehouseManaged = TWarehouseSelect & {
	storages: TWarehouseStorageSelect[];
};

/**
 * Person-in-charge application service (ADR-0017).
 *
 * @remarks
 * Owns the three rules the table cannot express:
 *
 * 1. **The target user must exist.** `user_id` is a logical reference to
 *    `auth.users.id` with no FK, so nothing in Postgres stops a typo from
 *    creating a grant for a ghost. The check goes through the Identity module
 *    facade ({@link UserService.getUser}), never a direct `auth.users` read.
 * 2. **A duplicate live assignment is a conflict, not a silent no-op.** The
 *    route is an admin action; an admin who assigns twice should learn that
 *    the second call did nothing.
 * 3. **Unassign is idempotent.** "Not assigned" is the desired end state
 *    either way, so a missing row answers `{ removed: false }`, matching
 *    `unlinkOrganization`.
 *
 * Every write is audited (`warehouse.manager_assigned` /
 * `warehouse.manager_removed`) with the acting admin as actor. Authorization is
 * not checked here: the routes ride `requireGlobalAdmin` at the guard level.
 */
@injectable()
export class WarehouseManagerService {
	constructor(
		@inject(WAREHOUSE_MANAGER_REPOSITORY_TOKEN)
		private readonly managerRepository: IWarehouseManagerRepository,
		@inject(WAREHOUSE_REPOSITORY_TOKEN)
		private readonly warehouseRepository: IWarehouseRepository,
		@inject(WAREHOUSE_STORAGE_REPOSITORY_TOKEN)
		private readonly storageRepository: IWarehouseStorageRepository,
		/** Target-user validation and the app-admin warehouse list. */
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: InventoryAuditWriter,
	) {}

	/**
	 * Warehouses the caller manages, each with its bins.
	 *
	 * @param userId - The authenticated caller
	 * @param isAppAdmin - Application admins see every live warehouse
	 * @returns Alive warehouses ordered by name, empty when the caller holds no
	 *   grant and is not an app admin
	 *
	 * @remarks
	 * The `storages` decoration matches `GET /warehouses/linked`: a picker that
	 * only knows warehouse names cannot select a bin, and the detail route now
	 * costs a PIC a second round trip for the same data.
	 */
	async listMine(
		userId: string,
		isAppAdmin: boolean,
	): Promise<TWarehouseManaged[]> {
		const managedIds = isAppAdmin
			? undefined
			: await this.managerRepository.listWarehouseIdsForUser(userId);
		const live = await this.warehouseRepository.findAlive(managedIds);

		return Promise.all(
			live.map(async (warehouse) => ({
				...warehouse,
				storages: await this.storageRepository.listByWarehouse(warehouse.id),
			})),
		);
	}

	/**
	 * Grants a user person-in-charge access to a warehouse.
	 *
	 * @param warehouseId - The warehouse
	 * @param userId - The target user (must exist)
	 * @param actor - The acting application admin
	 * @returns The live assignment row
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 * @throws {WarehouseManagerUserNotFoundError} When the user does not exist
	 * @throws {WarehouseManagerExistsError} When the grant already exists
	 */
	async assign(
		warehouseId: string,
		userId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TWarehouseManagerSelect> {
		const warehouse = await this.warehouseRepository.findById(warehouseId);
		if (!warehouse) throw new WarehouseNotFoundError();

		const user = await this.users.getUser(userId);
		if (!user) throw new WarehouseManagerUserNotFoundError();

		const existing = await this.managerRepository.findActive(
			warehouseId,
			userId,
		);
		if (existing) throw new WarehouseManagerExistsError();

		const assignment = await this.managerRepository.assign({
			warehouseId,
			userId,
			assignedBy: actor.userId,
		});

		await this.audit.record({
			actor,
			action: 'warehouse.manager_assigned',
			targetType: 'warehouse',
			targetId: warehouseId,
			organizationId: warehouse.organizationId,
			meta: {
				userId,
				userEmail: user.email,
				warehouseCode: warehouse.code,
			},
		});

		return assignment;
	}

	/**
	 * Revokes a person-in-charge grant.
	 *
	 * @param warehouseId - The warehouse
	 * @param userId - The user losing access
	 * @param actor - The acting application admin
	 * @returns Whether a live assignment was removed
	 * @throws {WarehouseNotFoundError} When the warehouse is absent or archived
	 */
	async unassign(
		warehouseId: string,
		userId: string,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<{ removed: boolean }> {
		const warehouse = await this.warehouseRepository.findById(warehouseId);
		if (!warehouse) throw new WarehouseNotFoundError();

		const removed = await this.managerRepository.unassign(warehouseId, userId);
		// Idempotent: nothing to audit when nothing changed, otherwise the
		// ledger would fill with no-op revocations.
		if (removed) {
			await this.audit.record({
				actor,
				action: 'warehouse.manager_removed',
				targetType: 'warehouse',
				targetId: warehouseId,
				organizationId: warehouse.organizationId,
				meta: {
					userId,
					warehouseCode: warehouse.code,
				},
			});
		}

		return { removed };
	}
}
