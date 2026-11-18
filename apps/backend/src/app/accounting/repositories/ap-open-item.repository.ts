import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { apOpenItems, type TApOpenItemSelect } from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IApOpenItemRepository } from '../contracts/ledger.repositories';

/**
 * Drizzle queries of `finance.ap_open_items` — the Accounts Payable sub-ledger
 * mirror of supplier bills.
 *
 * @remarks
 * `supplier_bill_id` is an intra-module reference (both tables are Finance's
 * own schema), so it is a real FK; the bill is resolved before the mirror is
 * written.
 */
@injectable()
export class ApOpenItemRepository implements IApOpenItemRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertApOpenItem(
		row: {
			organizationId: string;
			supplierBillId: string;
			supplierId: string | null;
			billDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TApOpenItemSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(apOpenItems)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async findApOpenItemByBill(
		organizationId: string,
		supplierBillId: string,
		tx?: TTx,
	): Promise<TApOpenItemSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(apOpenItems)
			.where(
				and(
					eq(apOpenItems.organizationId, organizationId),
					eq(apOpenItems.supplierBillId, supplierBillId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async updateApOpenItem(
		organizationId: string,
		supplierBillId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: TTx,
	): Promise<TApOpenItemSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(apOpenItems)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(apOpenItems.organizationId, organizationId),
					eq(apOpenItems.supplierBillId, supplierBillId),
				),
			)
			.returning();
		return updated ?? null;
	}

	async listApOpenItemsForAging(
		organizationId: string,
		supplierId?: string,
		tx?: TTx,
	): Promise<TApOpenItemSelect[]> {
		const db = tx ?? this.database;
		const conditions = [
			eq(apOpenItems.organizationId, organizationId),
			inArray(apOpenItems.status, ['open', 'partially_paid']),
		];
		if (supplierId) conditions.push(eq(apOpenItems.supplierId, supplierId));
		return db
			.select()
			.from(apOpenItems)
			.where(and(...conditions))
			.orderBy(asc(apOpenItems.dueDate));
	}
}
