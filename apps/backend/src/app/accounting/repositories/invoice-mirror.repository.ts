import { DRIZZLE_TOKEN } from '@di/provider';
import type { TTx } from '@drizzle/types';
import { invoices, type TInvoiceSelect } from '@drizzle/schemas/sales.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { IInvoiceMirrorRepository } from '../contracts/ledger.repositories';

/**
 * The AR sub-ledger's view of `sales.invoices`.
 *
 * @remarks
 * This is the only accounting repository that touches another module's table,
 * and it is deliberate rather than accidental: settling a receipt must update
 * the invoice's `paid_total` / `outstanding_total` inside the same transaction
 * that moves the AR mirror, or the two disagree.
 *
 * It is still a `elysia-module` rule 3.2/3.4 deviation — inherited from the
 * AR/AP sub-ledger design, not introduced here. Confining it to one small
 * repository means no other accounting repository can reach `sales`, and the
 * eventual fix (a Sales-owned contract, like `IInvoicePaymentPort`) has exactly
 * two methods to move. Tracked in `docs/plan/backlog.md`.
 */
@injectable()
export class InvoiceMirrorRepository implements IInvoiceMirrorRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findSalesInvoiceById(
		organizationId: string,
		invoiceId: string,
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select()
			.from(invoices)
			.where(
				and(
					eq(invoices.id, invoiceId),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async updateSalesInvoiceTotals(
		organizationId: string,
		invoiceId: string,
		patch: { paidTotal?: number; outstandingTotal?: number; status?: string },
		tx?: TTx,
	): Promise<TInvoiceSelect | null> {
		const db = tx ?? this.database;
		const [updated] = await db
			.update(invoices)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(invoices.id, invoiceId),
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
				),
			)
			.returning();
		return updated ?? null;
	}
}
