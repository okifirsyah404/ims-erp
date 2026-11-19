import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type TItemSerialSelect,
	itemSerials,
	type SerialStatus,
} from '@drizzle/schemas/inventory.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	IItemSerialRepository,
	TUnitCreateData,
	TUnitPaginationRequest,
} from '../contracts/item-serial.repository.interface';

/**
 * Drizzle implementation of {@link IItemSerialRepository}.
 *
 * @remarks
 * The provisional-serial replacement is the one place a `serial_number` may
 * change. The guard is expressed as a `WHERE` predicate rather than a read
 * followed by a write, so two concurrent replacements cannot both succeed.
 */
@injectable()
export class ItemSerialRepository implements IItemSerialRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/** Fetches one filtered page of units. */
	async paginate(
		request: TUnitPaginationRequest,
	): Promise<TPaginationResult<TItemSerialSelect>> {
		const { page, limit, productId, status, warehouseId } = request;

		const filters = [
			isNull(itemSerials.deletedAt),
			productId ? eq(itemSerials.productId, productId) : undefined,
			status ? eq(itemSerials.status, status) : undefined,
			warehouseId
				? eq(itemSerials.warehouseId, warehouseId)
				: undefined,
		].filter(Boolean);

		const where = and(...filters);

		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(itemSerials)
			.where(where);

		const data = await this.database
			.select()
			.from(itemSerials)
			.where(where)
			.orderBy(asc(itemSerials.serialNumber))
			.limit(limit)
			.offset((page - 1) * limit);

		return {
			meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
			data,
		};
	}

	/** Fetches one alive unit by id. */
	async findById(id: string): Promise<TItemSerialSelect | null> {
		const [row] = await this.database
			.select()
			.from(itemSerials)
			.where(
				and(eq(itemSerials.id, id), isNull(itemSerials.deletedAt)),
			)
			.limit(1);
		return row ?? null;
	}

	/** Fetches one alive unit by tenant + serial number. */
	async findBySerial(
		organizationId: string | null,
		serialNumber: string,
	): Promise<TItemSerialSelect | null> {
		const [row] = await this.database
			.select()
			.from(itemSerials)
			.where(
				and(
					isNull(itemSerials.deletedAt),
					eq(itemSerials.serialNumber, serialNumber),
					organizationId === null
						? isNull(itemSerials.organizationId)
						: eq(itemSerials.organizationId, organizationId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** Inserts a unit. */
	async create(
		data: TUnitCreateData,
		tx?: TTx,
	): Promise<TItemSerialSelect> {
		const [row] = await (tx ?? this.database)
			.insert(itemSerials)
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
	): Promise<TItemSerialSelect | null> {
		const [row] = await this.database
			.update(itemSerials)
			.set({ serialNumber, isProvisionalSerial: false })
			.where(
				and(
					eq(itemSerials.id, id),
					isNull(itemSerials.deletedAt),
					eq(itemSerials.isProvisionalSerial, true),
					eq(itemSerials.status, 'pre_order'),
				),
			)
			.returning();
		return row ?? null;
	}

	/** Applies a status transition. */
	async updateStatus(
		id: string,
		status: TItemSerialSelect['status'],
	): Promise<TItemSerialSelect | null> {		const [row] = await this.database
			.update(itemSerials)
			.set({ status })
			.where(
				and(eq(itemSerials.id, id), isNull(itemSerials.deletedAt)),
			)
			.returning();
		return row ?? null;
	}

	async listInStockSerials(productId: string, warehouseId: string): Promise<string[]> {
		const rows = await this.database
			.select({ serialNumber: itemSerials.serialNumber })
			.from(itemSerials)
			.where(
				and(
					eq(itemSerials.productId, productId),
					eq(itemSerials.warehouseId, warehouseId),
					eq(itemSerials.status, 'in_stock'),
					isNull(itemSerials.deletedAt),
				),
			)
			.orderBy(asc(itemSerials.serialNumber));
		return rows.map((row) => row.serialNumber);
	}

	async sell(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; customerId: string | null; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		if (serialNumbers.length === 0) return [];
		const rows = await tx
			.update(itemSerials)
			.set({
				status: 'sold',
				warehouseId: null,
				binId: null,
				customerId: data.customerId,
				movementId: data.movementId,
			})
			.where(
				and(
					eq(itemSerials.productId, productId),
					inArray(itemSerials.serialNumber, [...serialNumbers]),
					eq(itemSerials.warehouseId, data.warehouseId),
					eq(itemSerials.status, 'in_stock'),
					isNull(itemSerials.deletedAt),
				),
			)
			.returning({ serialNumber: itemSerials.serialNumber });
		return rows.map((row) => row.serialNumber);
	}

	async listSerialsInStatuses(productId: string, warehouseId: string, statuses: readonly SerialStatus[]): Promise<string[]> {
		const rows = await this.database
			.select({ serialNumber: itemSerials.serialNumber })
			.from(itemSerials)
			.where(
				and(
					eq(itemSerials.productId, productId),
					eq(itemSerials.warehouseId, warehouseId),
					inArray(itemSerials.status, [...statuses]),
					isNull(itemSerials.deletedAt),
				),
			)
			.orderBy(asc(itemSerials.serialNumber));
		return rows.map((row) => row.serialNumber);
	}

	async receiveFromCustomer(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; binId: string | null; status: 'in_stock' | 'damaged'; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		if (serialNumbers.length === 0) return [];
		const rows = await tx
			.update(itemSerials)
			.set({
				status: data.status,
				warehouseId: data.warehouseId,
				binId: data.binId,
				customerId: null,
				movementId: data.movementId,
			})
			.where(
				and(
					eq(itemSerials.productId, productId),
					inArray(itemSerials.serialNumber, [...serialNumbers]),
					eq(itemSerials.status, 'sold'),
					isNull(itemSerials.deletedAt),
				),
			)
			.returning({ serialNumber: itemSerials.serialNumber });
		return rows.map((row) => row.serialNumber);
	}

	async returnToSupplier(
		productId: string,
		serialNumbers: readonly string[],
		data: { warehouseId: string; movementId: string | null },
		tx: TTx,
	): Promise<string[]> {
		if (serialNumbers.length === 0) return [];
		const rows = await tx
			.update(itemSerials)
			.set({ status: 'returned', warehouseId: null, binId: null, movementId: data.movementId })
			.where(
				and(
					eq(itemSerials.productId, productId),
					inArray(itemSerials.serialNumber, [...serialNumbers]),
					eq(itemSerials.warehouseId, data.warehouseId),
					inArray(itemSerials.status, ['in_stock', 'damaged']),
					isNull(itemSerials.deletedAt),
				),
			)
			.returning({ serialNumber: itemSerials.serialNumber });
		return rows.map((row) => row.serialNumber);
	}
}
