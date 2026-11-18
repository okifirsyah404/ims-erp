import { inject, injectable } from 'tsyringe';
import type { TTx } from '@drizzle/types';
import type { TJournalEntrySelect } from '@drizzle/schemas/accounting.schema';
import { AR_OPEN_ITEM_REPOSITORY_TOKEN, JOURNAL_REPOSITORY_TOKEN } from '../constants/di';
import type { IArOpenItemRepository } from '../contracts/ar-open-item.repository.interface';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import type { IArLedgerPort } from '../contracts/ar-ledger.port';

/**
 * Accounting side of {@link IArLedgerPort}: the AR open-item mirror and the
 * journal-entry lookup Sales needs when it issues or voids an invoice.
 */
@injectable()
export class ArLedgerPortService implements IArLedgerPort {
	constructor(
		@inject(AR_OPEN_ITEM_REPOSITORY_TOKEN)
		private readonly ar: Pick<IArOpenItemRepository, 'insertArOpenItem' | 'updateArOpenItem'>,
		@inject(JOURNAL_REPOSITORY_TOKEN)
		private readonly journal: Pick<IJournalRepository, 'findEntryBySource'>,
	) {}

	async openItem(
		organizationId: string,
		input: {
			salesInvoiceId: string;
			customerId: string | null;
			invoiceDate: string | null;
			dueDate: string | null;
			originalAmount: number;
			paidAmount: number;
			outstandingAmount: number;
			currencyCode: string;
			status: string;
		},
		tx?: unknown,
	): Promise<void> {
		await this.ar.insertArOpenItem({ organizationId, ...input }, tx as TTx | undefined);
	}

	async setOpenItemStatus(
		organizationId: string,
		salesInvoiceId: string,
		patch: { paidAmount?: number; outstandingAmount?: number; status?: string },
		tx?: unknown,
	): Promise<void> {
		await this.ar.updateArOpenItem(organizationId, salesInvoiceId, patch, tx as TTx | undefined);
	}

	findPostedEntryForSource(
		organizationId: string,
		sourceType: string,
		sourceId: string,
		tx?: unknown,
	): Promise<TJournalEntrySelect | null> {
		return this.journal.findEntryBySource(organizationId, sourceType, sourceId, tx as TTx | undefined);
	}
}
