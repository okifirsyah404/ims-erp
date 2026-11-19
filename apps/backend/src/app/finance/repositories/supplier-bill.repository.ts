import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { supplierBills, type TSupplierBillSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { ISupplierBillRepository } from '../contracts/supplier-bill.repository.interface';

/** Drizzle queries of `finance.supplier_bills`. Tenant scoped, soft-delete aware. */
@injectable()
export class SupplierBillRepository implements ISupplierBillRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertSupplierBill(
		row: {
			organizationId: string;
			code: string;
			supplierCompanyId: string;
			purchaseOrderId: string | null;
			supplierInvoiceNumber?: string | null;
			billDate: string | null;
			dueDate: string | null;
			subtotal: number;
			taxTotal: number;
			grandTotal: number;
			paidTotal: number;
			outstandingTotal: number;
			currencyCode: string;
			status: string;
			approvedBy: string | null;
			approvedAt: Date | null;
		},
		tx?: TTx,
	): Promise<TSupplierBillSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(supplierBills)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async findSupplierBillById(
		organizationId: string,
		id: string,
		tx?: TTx,
	): Promise<TSupplierBillSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(supplierBills)
			.where(
				and(
					eq(supplierBills.id, id),
					eq(supplierBills.organizationId, organizationId),
					isNull(supplierBills.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async updateSupplierBill(
		organizationId: string,
		id: string,
		patch: Record<string, unknown>,
		tx?: TTx,
	): Promise<TSupplierBillSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(supplierBills)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(supplierBills.id, id),
					eq(supplierBills.organizationId, organizationId),
					isNull(supplierBills.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}

	/**
	 * Open bills (recorded, not fully paid) due on or before `date`, in every
	 * organization: the daily `supplier_bill.due` job (ERP-0012).
	 */
	async listOpenBillsDueBy(date: string): Promise<TSupplierBillSelect[]> {
		return this.database
			.select()
			.from(supplierBills)
			.where(
				and(
					inArray(supplierBills.status, ['approved', 'partially_paid', 'overdue']),
					sql`${supplierBills.outstandingTotal} > 0`,
					sql`${supplierBills.dueDate} IS NOT NULL AND ${supplierBills.dueDate} <= ${date}`,
					isNull(supplierBills.deletedAt),
				),
			)
			.orderBy(asc(supplierBills.dueDate));
	}

	async listSupplierBills(
		organizationId: string,
		filters: { status?: string; supplierCompanyId?: string },
		pagination: { page: number; limit: number },
	): Promise<TPaginationResult<TSupplierBillSelect>> {
		const conditions = [
			eq(supplierBills.organizationId, organizationId),
			isNull(supplierBills.deletedAt),
		];
		if (filters.status) conditions.push(eq(supplierBills.status, filters.status));
		if (filters.supplierCompanyId) {
			conditions.push(eq(supplierBills.supplierCompanyId, filters.supplierCompanyId));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(supplierBills)
			.where(where);
		const data = await this.database
			.select()
			.from(supplierBills)
			.where(where)
			.orderBy(desc(supplierBills.createdAt))
			.limit(pagination.limit)
			.offset((pagination.page - 1) * pagination.limit);
		return {
			data,
			meta: {
				page: pagination.page,
				limit: pagination.limit,
				total,
				totalPages: Math.ceil(total / pagination.limit) || 1,
			},
		};
	}
}
