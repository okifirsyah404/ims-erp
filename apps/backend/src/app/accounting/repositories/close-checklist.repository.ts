import { DRIZZLE_TOKEN } from '@di/provider';
import { journalEntries } from '@drizzle/schemas/accounting.schema';
import {
	bankReconciliations,
	supplierBills,
} from '@drizzle/schemas/finance.schema';
import { invoices } from '@drizzle/schemas/sales.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type {
	ICloseChecklistRepository,
	TCloseChecklistCounts,
} from '../contracts/ledger.repositories';

/**
 * Read model behind the month-end close checklist (F7).
 *
 * @remarks
 * A report, not an entity: it counts four tables in one round trip, which is
 * why it is its own repository instead of a method on an entity repository.
 * Open payments are intentionally absent — the payment module owns
 * `payment.payments` and answers through its gateway (ADR-0024).
 */
@injectable()
export class CloseChecklistRepository implements ICloseChecklistRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async closeChecklistCounts(
		organizationId: string,
		startDate: string,
		endDate: string,
	): Promise<TCloseChecklistCounts> {
		const [draftInvoices] = await this.database
			.select({ value: count() })
			.from(invoices)
			.where(
				and(
					eq(invoices.organizationId, organizationId),
					isNull(invoices.deletedAt),
					eq(invoices.status, 'draft'),
					gte(invoices.createdAt, new Date(`${startDate}T00:00:00Z`)),
					lte(invoices.createdAt, new Date(`${endDate}T23:59:59Z`)),
				),
			);
		const [posted] = await this.database
			.select({ value: count() })
			.from(journalEntries)
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					eq(journalEntries.status, 'posted'),
					isNull(journalEntries.deletedAt),
					sql`${journalEntries.entryDate} >= ${startDate}`,
					sql`${journalEntries.entryDate} <= ${endDate}`,
				),
			);
		const [draftBills] = await this.database
			.select({ value: count() })
			.from(supplierBills)
			.where(
				and(
					eq(supplierBills.organizationId, organizationId),
					isNull(supplierBills.deletedAt),
					eq(supplierBills.status, 'draft'),
				),
			);
		const [openReconciliations] = await this.database
			.select({ value: count() })
			.from(bankReconciliations)
			.where(
				and(
					eq(bankReconciliations.organizationId, organizationId),
					isNull(bankReconciliations.deletedAt),
					inArray(bankReconciliations.status, ['draft', 'in_progress']),
				),
			);
		return {
			draftInvoicesInRange: Number(draftInvoices?.value ?? 0),
			postedInPeriod: Number(posted?.value ?? 0),
			draftBills: Number(draftBills?.value ?? 0),
			unreconciledReconciliations: Number(openReconciliations?.value ?? 0),
		};
	}
}
