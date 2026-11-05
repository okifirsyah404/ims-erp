import { DRIZZLE_TOKEN } from '@di/provider';
import {
	TSerialTrackedItemSelect,
	serialTrackedItems,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	ISerialUnitRepository,
	TUnitCreateData,
	TUnitPaginationRequest,
} from '../contracts/serial-unit.repository.interface';
import type { TTx } from '@drizzle/types';

/**
 * Drizzle implementation of {@link ISerialUnitRepository}.
 *
 * @remarks
 * The provisional-serial replacement is the one place a `serial_number` may
 * change. The guard is expressed as a `WHERE` predicate rather than a read
 * followed by a write, so two concurrent replacements cannot both succeed.
 */
@injectable()
export class SerialUnitRepository implements ISerialUnitRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/** Fetches one filtered page of units. */
	async paginate(
		request: TUnitPaginationRequest,
	): Promise<TPaginationResult<TSerialTrackedItemSelect>> {
		const { page, limit, itemId, status, warehouseId } = request;

		const filters = [
			isNull(serialTrackedItems.deletedAt),
			itemId ? eq(serialTrackedItems.itemId, itemId) : undefined,
			status ? eq(serialTrackedItems.status, status) : undefined,
			warehouseId
				? eq(serialTrackedItems.warehouseId, warehouseId)
				: undefined,
		].filter(Boolean);

		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(serialTrackedItems)
			.where(where);

		const data = await this.database
			.select()
			.from(serialTrackedItems)
			.where(where)
			.orderBy(asc(serialTrackedItems.serialNumber))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	/** Fetches one alive unit by id. */
	async findById(id: string): Promise<TSerialTrackedItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(serialTrackedItems)
			.where(
				and(eq(serialTrackedItems.id, id), isNull(serialTrackedItems.deletedAt)),
			)
			.limit(1);
		return row ?? null;
	}

	/** Fetches one alive unit by tenant + serial number. */
	async findBySerial(
		organizationId: string | null,
		serialNumber: string,
	): Promise<TSerialTrackedItemSelect | null> {
		const [row] = await this.database
			.select()
			.from(serialTrackedItems)
			.where(
				and(
					isNull(serialTrackedItems.deletedAt),
					eq(serialTrackedItems.serialNumber, serialNumber),
					organizationId === null
						? isNull(serialTrackedItems.organizationId)
						: eq(serialTrackedItems.organizationId, organizationId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Inserts a unit. */
	async create(
		data: TUnitCreateData,
		tx?: TTx,
	): Promise<TSerialTrackedItemSelect> {
		const [row] = await (tx ?? this.database)
			.insert(serialTrackedItems)
			// `created_at` is NOT NULL without a database default (like items).
			.values({ ...data, createdAt: new Date() } as never)
			.returning();
		return row;
	}

	/**
	 * Replaces a provisional serial with the real one, exactly once.
	 *
	 * @remarks
	 * The `is_provisional_serial = true AND status = 'pre_order'` predicate is
	 * part of the `UPDATE`, so the guard is atomic: a second concurrent call
	 * matches no row and returns `null` instead of overwriting.
	 */
	async replaceProvisionalSerial(
		id: string,
		serialNumber: string,
	): Promise<TSerialTrackedItemSelect | null> {
		const [row] = await this.database
			.update(serialTrackedItems)
			.set({ serialNumber, isProvisionalSerial: false })
			.where(
				and(
					eq(serialTrackedItems.id, id),
					isNull(serialTrackedItems.deletedAt),
					eq(serialTrackedItems.isProvisionalSerial, true),
					eq(serialTrackedItems.status, 'pre_order'),
				),
			)
			.returning();
		return row ?? null;
	}

	/** Applies a status transition. */
	async updateStatus(
		id: string,
		status: TSerialTrackedItemSelect['status'],
	): Promise<TSerialTrackedItemSelect | null> {		const [row] = await this.database
			.update(serialTrackedItems)
			.set({ status })
			.where(
				and(eq(serialTrackedItems.id, id), isNull(serialTrackedItems.deletedAt)),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Moves a unit's custody to a borrower, ref-ing the line it went out on.
	 *
	 * @remarks
	 * Guarded on `status = 'in_stock'` **inside** the update, so a unit cannot
	 * be issued twice even if two borrowing flows race: the second update
	 * matches no row and returns `null`. `warehouse_id`/`bin_id` are cleared
	 * because custody has left the warehouse — a tool in a technician's van is
	 * not warehouse stock.
	 */
	async issueToBorrower(
		id: string,
		borrowingLineId: string,
		tx?: TTx,
	): Promise<TSerialTrackedItemSelect | null> {
		const handle = tx ?? this.database;
		const [row] = await handle
			.update(serialTrackedItems)
			.set({
				status: 'borrowed',
				warehouseId: null,
				binId: null,
				currentBorrowingLineId: borrowingLineId,
			})
			.where(
				and(
					eq(serialTrackedItems.id, id),
					isNull(serialTrackedItems.deletedAt),
					eq(serialTrackedItems.status, 'in_stock'),
				),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Returns a unit from custody to a warehouse.
	 *
	 * @remarks
	 * Guarded on `status = 'borrowed'`. The warehouse and bin are restored from
	 * the line's `origin_warehouse_id`, which the issuance snapshotted.
	 */
	async returnFromBorrower(
		id: string,
		warehouseId: string,
		binId: string | null,
		tx?: TTx,
	): Promise<TSerialTrackedItemSelect | null> {
		const handle = tx ?? this.database;
		const [row] = await handle
			.update(serialTrackedItems)
			.set({
				status: 'in_stock',
				warehouseId,
				binId,
				currentBorrowingLineId: null,
			})
			.where(
				and(
					eq(serialTrackedItems.id, id),
					isNull(serialTrackedItems.deletedAt),
					eq(serialTrackedItems.status, 'borrowed'),
				),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Marks a borrowed unit lost.
	 *
	 * @remarks
	 * The warehouse is **not** restored: the unit is gone from stock, which is
	 * why the loss flow also writes an `adjustment_out` movement against the
	 * line's origin warehouse.
	 */
	async markLost(
		id: string,
		tx?: TTx,
	): Promise<TSerialTrackedItemSelect | null> {
		const handle = tx ?? this.database;
		const [row] = await handle
			.update(serialTrackedItems)
			.set({
				status: 'lost',
				warehouseId: null,
				binId: null,
				currentBorrowingLineId: null,
			})
			.where(
				and(
					eq(serialTrackedItems.id, id),
					isNull(serialTrackedItems.deletedAt),
					eq(serialTrackedItems.status, 'borrowed'),
				),
			)
			.returning();
		return row ?? null;
	}
}
