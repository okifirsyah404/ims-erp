import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { arOpenItems, type TArOpenItemSelect } from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IArOpenItemRepository, TArOpenItemPatch } from '../contracts/ar-open-item.repository.interface';

/**
 * Drizzle queries of `finance.ar_open_items` — the Accounts Receivable
 * sub-ledger mirror of sales invoices.
 *
 * @remarks
 * `sales_invoice_id` is a logical reference to Sales (no FK, ADR-0014); Sales'
 * contract resolves the invoice before Accounting writes this mirror.
 */
@injectable()
export class ArOpenItemRepository implements IArOpenItemRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async insertArOpenItem(
		row: {
			organizationId: string;
			invoiceId: string | null;
			customerId: string | null;
			invoiceDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: TTx,
	): Promise<TArOpenItemSelect> {
		const db = tx ?? this.database;
		const now = new Date();
		const [created] = await db
			.insert(arOpenItems)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async findArOpenItemByInvoice(
		organizationId: string,
		invoiceId: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(arOpenItems)
			.where(
				and(
					eq(arOpenItems.organizationId, organizationId),
					eq(arOpenItems.invoiceId, invoiceId),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async updateArOpenItem(
		organizationId: string,
		invoiceId: string,
		patch: TArOpenItemPatch,
		tx?: TTx,
	): Promise<TArOpenItemSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(arOpenItems)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(arOpenItems.organizationId, organizationId),
					eq(arOpenItems.invoiceId, invoiceId),
				),
			)
			.returning();
		return updated ?? null;
	}

	async listWriteOffRequests(organizationId: string): Promise<TArOpenItemSelect[]> {
		return this.database
			.select()
			.from(arOpenItems)
			.where(
				and(
					eq(arOpenItems.organizationId, organizationId),
					isNotNull(arOpenItems.writeOffRequestedAt),
					isNull(arOpenItems.writtenOffAt),
				),
			)
			.orderBy(asc(arOpenItems.writeOffRequestedAt));
	}

	async listArOpenItemsForAging(
		organizationId: string,
		customerId?: string,
		tx?: TTx,
	): Promise<TArOpenItemSelect[]> {
		const db = tx ?? this.database;
		const conditions = [
			eq(arOpenItems.organizationId, organizationId),
			inArray(arOpenItems.status, ['open', 'partially_paid']),
		];
		if (customerId) conditions.push(eq(arOpenItems.customerId, customerId));
		return db
			.select()
			.from(arOpenItems)
			.where(and(...conditions))
			.orderBy(asc(arOpenItems.dueDate));
	}
}
