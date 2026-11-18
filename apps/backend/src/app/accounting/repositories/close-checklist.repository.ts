import { DRIZZLE_TOKEN } from '@di/provider';
import { journalEntries } from '@drizzle/schemas/accounting.schema';
import {
	bankReconciliations,
	supplierBills,
} from '@drizzle/schemas/finance.schema';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { ICloseChecklistRepository, TCloseChecklistCounts } from '../contracts/close-checklist.repository.interface';

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
			postedInPeriod: Number(posted?.value ?? 0),
			draftBills: Number(draftBills?.value ?? 0),
			unreconciledReconciliations: Number(openReconciliations?.value ?? 0),
		};
	}
}
