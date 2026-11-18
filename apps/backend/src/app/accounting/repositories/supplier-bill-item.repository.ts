import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import {
	supplierBillItems,
	supplierBills,
	type TSupplierBillItemInsert,
	type TSupplierBillItemSelect,
} from '@drizzle/schemas/finance.schema';
import { quantityToMilli } from '@utils/money.util';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { ISupplierBillItemRepository } from '../contracts/supplier-bill-item.repository.interface';

/**
 * Drizzle queries of `finance.supplier_bill_items`. Tenant scoped, soft-delete
 * aware. `billedQuantities` joins `supplier_bills` to ignore void bills.
 */
@injectable()
export class SupplierBillItemRepository implements ISupplierBillItemRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertSupplierBillItems(
		rows: Omit<TSupplierBillItemInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[],
		tx?: TTx,
	): Promise<TSupplierBillItemSelect[]> {
		if (rows.length === 0) return [];
		const db = tx ?? this.database;
		const now = new Date();
		return db
			.insert(supplierBillItems)
			.values(rows.map((row) => ({ ...row, createdAt: now, updatedAt: now })))
			.returning();
	}

	async findSupplierBillItems(
		organizationId: string,
		supplierBillId: string,
		tx?: TTx,
	): Promise<TSupplierBillItemSelect[]> {
		const db = tx ?? this.database;
		return db
			.select()
			.from(supplierBillItems)
			.where(
				and(
					eq(supplierBillItems.supplierBillId, supplierBillId),
					eq(supplierBillItems.organizationId, organizationId),
					isNull(supplierBillItems.deletedAt),
				),
			)
			.orderBy(asc(supplierBillItems.sortOrder));
	}

	/**
	 * Quantity already billed per purchase order line on live (not void) bills,
	 * in thousandths. Across every organization: a purchase order is
	 * company-wide, so a line billed in one organization cannot be billed
	 * again in another (ERP-0012).
	 */
	async billedQuantities(purchaseOrderItemIds: string[], tx?: TTx): Promise<Map<string, bigint>> {
		const result = new Map<string, bigint>();
		if (purchaseOrderItemIds.length === 0) return result;
		const db = tx ?? this.database;
		const rows = await db
			.select({
				purchaseOrderItemId: supplierBillItems.purchaseOrderItemId,
				quantity: sql<string>`sum(${supplierBillItems.quantity})`,
			})
			.from(supplierBillItems)
			.innerJoin(supplierBills, eq(supplierBills.id, supplierBillItems.supplierBillId))
			.where(
				and(
					inArray(supplierBillItems.purchaseOrderItemId, purchaseOrderItemIds),
					ne(supplierBills.status, 'void'),
					isNull(supplierBills.deletedAt),
					isNull(supplierBillItems.deletedAt),
				),
			)
			.groupBy(supplierBillItems.purchaseOrderItemId);
		for (const row of rows) {
			if (row.purchaseOrderItemId) result.set(row.purchaseOrderItemId, quantityToMilli(Number(row.quantity).toFixed(3)));
		}
		return result;
	}

	/**
	 * Serializes bills of one purchase order (ERP-0012): a transaction-scoped
	 * advisory lock keyed on the order, so two finance users cannot both bill
	 * the same received quantity.
	 */
	async lockPurchaseOrderBilling(purchaseOrderId: string, tx: TTx): Promise<void> {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`bill:${purchaseOrderId}`}, 0))`);
	}
}
