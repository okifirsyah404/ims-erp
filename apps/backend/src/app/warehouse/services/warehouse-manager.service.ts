import { inject, injectable } from 'tsyringe';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { SYSTEM_AUDIT_ACTOR, type TAuditActor } from '@shared/audit';
import type {
	TWarehouseManagerSelect,
	TWarehouseSelect,
	TWarehouseStorageSelect,
} from '@drizzle/schemas/warehouse.schema';
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
} from '../errors/warehouse.errors';
import { AuditWriter } from '@shared/audit';

/** A warehouse the caller manages, with its bins (ADR-0017, `GET /warehouses/mine`). */
export type TWarehouseManaged = TWarehouseSelect & {
	storages: TWarehouseStorageSelect[];
};

/**
 * One live person-in-charge grant, decorated for the admin screen.
 *
 * @remarks
 * `name`/`email` are resolved through the Identity facade at read time; both
 * are `null` when the referenced account no longer exists (the grant is a
 * logical reference, so it can outlive its user).
 */
export type TWarehouseManagerView = {
	userId: string;
	name: string | null;
	email: string | null;
	assignedBy: string | null;
	assignedAt: Date;
};

/** One assignable account for the PIC picker. */
export type TWarehouseManagerCandidate = {
	id: string;
	name: string;
	email: string;
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
		private readonly users: Pick<UserService, 'getUser' | 'paginateUsers'>,
		/** Fire-and-forget audit writer (hardening plan D3). */
		private readonly audit: AuditWriter,
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
	 * Live person-in-charge grants of one warehouse, decorated with the
	 * account's name and email.
	 *
	 * @param warehouseId - The warehouse
	 * @returns Live assignments, oldest first; empty when nobody is assigned
	 * @throws {WarehouseNotFoundError} When the warehouse does not exist
	 *
	 * @remarks
	 * `user_id` is a logical reference, so an assignment can outlive its
	 * account. Such a row still appears (an admin has to be able to revoke it)
	 * with `name`/`email` null. A row whose `user_id` is NULL grants nothing and
	 * is skipped — it can only come from a direct database edit, since
	 * {@link assign} validates the user before writing.
	 */
	async listManagers(warehouseId: string): Promise<TWarehouseManagerView[]> {
		const warehouse = await this.warehouseRepository.findById(warehouseId);
		if (!warehouse) throw new WarehouseNotFoundError();

		const rows = await this.managerRepository.listByWarehouse(warehouseId);
		const assigned = rows.filter(
			(row): row is TWarehouseManagerSelect & { userId: string } =>
				row.userId !== null,
		);
		return Promise.all(
			assigned.map(async (row) => {
				const user = await this.users.getUser(row.userId);
				return {
					userId: row.userId,
					name: user?.name ?? null,
					email: user?.email ?? null,
					assignedBy: row.assignedBy,
					assignedAt: row.createdAt,
				};
			}),
		);
	}

	/**
	 * Accounts an application admin may pick as a person in charge.
	 *
	 * @param term - Optional free-text term (name, email, or username)
	 * @param limit - Maximum candidates returned
	 * @returns Live accounts ordered by name
	 *
	 * @remarks
	 * Read through the Identity facade, never `auth.users` directly. There is
	 * no organization filter: a PIC does not need a membership (ADR-0017 §3),
	 * and the caller is an application admin.
	 */
	async searchCandidates(
		term: string | undefined,
		limit = 20,
	): Promise<TWarehouseManagerCandidate[]> {
		const page = await this.users.paginateUsers({
			page: 1,
			limit,
			...(term ? { search: term } : {}),
		});
		return page.data.map((user) => ({
			id: user.id,
			name: user.name,
			email: user.email,
		}));
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
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
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
		actor: TAuditActor = SYSTEM_AUDIT_ACTOR,
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
