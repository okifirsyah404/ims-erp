import { DRIZZLE_TOKEN } from '@di/provider';
import {
	warehouseManagers,
	warehouses,
} from '@drizzle/schemas/inventory.schema';
import type { TWarehouseManagerSelect } from '@drizzle/schemas/inventory.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IWarehouseManagerRepository } from '../contracts/warehouse-manager.repository.interface';

/**
 * Drizzle implementation of {@link IWarehouseManagerRepository} (ADR-0017).
 *
 * @remarks
 * Three rules drive this file:
 *
 * 1. **Alive only.** Every read filters `deleted_at IS NULL`: a soft-deleted
 *    assignment grants nothing, so `warehouseGuard` must never see it.
 * 2. **The join to `inventory.warehouses` is intra-module** (ADR-0008), so an
 *    archived warehouse drops out of the caller's managed list without any
 *    extra cleanup — a PIC of an archived warehouse simply has no warehouse.
 * 3. **`user_id` is a logical reference to `auth.users.id`** (cross-module FK
 *    forbidden), so a row can outlive its user. `listWarehouseIdsForUser` is
 *    always driven by an authenticated `user_id`, so a dangling row is never
 *    reachable.
 */
@injectable()
export class WarehouseManagerRepository implements IWarehouseManagerRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/**
	 * Live warehouses the user is an active person in charge of.
	 *
	 * @param userId - The authenticated caller
	 * @returns Alive warehouse ids, oldest assignment first
	 */
	async listWarehouseIdsForUser(userId: string): Promise<string[]> {
		const rows = await this.database
			.select({ warehouseId: warehouseManagers.warehouseId })
			.from(warehouseManagers)
			.innerJoin(
				warehouses,
				eq(warehouses.id, warehouseManagers.warehouseId),
			)
			.where(
				and(
					eq(warehouseManagers.userId, userId),
					isNull(warehouseManagers.deletedAt),
					isNull(warehouses.deletedAt),
				),
			)
			.orderBy(asc(warehouseManagers.createdAt));
		return rows.map((row) => row.warehouseId);
	}

	/** The alive assignment for a pair, or `null`. */
	async findActive(
		warehouseId: string,
		userId: string,
	): Promise<TWarehouseManagerSelect | null> {
		const [row] = await this.database
			.select()
			.from(warehouseManagers)
			.where(
				and(
					eq(warehouseManagers.warehouseId, warehouseId),
					eq(warehouseManagers.userId, userId),
					isNull(warehouseManagers.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Alive assignments of one warehouse, oldest first.
	 *
	 * @param warehouseId - The warehouse
	 * @returns Live assignment rows (a soft-deleted grant is excluded)
	 */
	async listByWarehouse(
		warehouseId: string,
	): Promise<TWarehouseManagerSelect[]> {
		return this.database
			.select()
			.from(warehouseManagers)
			.where(
				and(
					eq(warehouseManagers.warehouseId, warehouseId),
					isNull(warehouseManagers.deletedAt),
				),
			)
			.orderBy(asc(warehouseManagers.createdAt));
	}

	/**
	 * Creates an alive assignment, reviving a soft-deleted one for the pair.
	 *
	 * @remarks
	 * Revival mirrors `WarehouseRepository.linkOrganization`: the partial
	 * unique index only constrains alive rows, so inserting a second row for a
	 * previously archived pair would leave a dead duplicate behind forever.
	 */
	async assign(input: {
		warehouseId: string;
		userId: string;
		assignedBy: string | null;
	}): Promise<TWarehouseManagerSelect> {
		const [existing] = await this.database
			.select({
				id: warehouseManagers.id,
				deletedAt: warehouseManagers.deletedAt,
			})
			.from(warehouseManagers)
			.where(
				and(
					eq(warehouseManagers.warehouseId, input.warehouseId),
					eq(warehouseManagers.userId, input.userId),
				),
			)
			.limit(1);

		if (existing?.deletedAt === null) {
			const [row] = await this.database
				.select()
				.from(warehouseManagers)
				.where(eq(warehouseManagers.id, existing.id))
				.limit(1);
			return row!;
		}

		if (existing) {
			const [revived] = await this.database
				.update(warehouseManagers)
				.set({
					deletedAt: null,
					assignedBy: input.assignedBy,
					updatedAt: new Date(),
				})
				.where(eq(warehouseManagers.id, existing.id))
				.returning();
			return revived!;
		}

		const [created] = await this.database
			.insert(warehouseManagers)
			.values({
				warehouseId: input.warehouseId,
				userId: input.userId,
				assignedBy: input.assignedBy,
				createdAt: new Date(),
			})
			.returning();
		return created!;
	}

	/** Soft-deletes the alive assignment for a pair. */
	async unassign(warehouseId: string, userId: string): Promise<boolean> {
		const deleted = await this.database
			.update(warehouseManagers)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(warehouseManagers.warehouseId, warehouseId),
					eq(warehouseManagers.userId, userId),
					isNull(warehouseManagers.deletedAt),
				),
			)
			.returning({ id: warehouseManagers.id });
		return deleted.length > 0;
	}
}
