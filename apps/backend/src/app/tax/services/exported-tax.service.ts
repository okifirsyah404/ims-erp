import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { PPH21_TABLE_SERVICE_TOKEN, TAX_NUMBERING_SERVICE_TOKEN, TAX_REPOSITORY_TOKEN } from '../constants/di';
import type { TTaxRepository } from '../contracts/tax.repository.interface';
import type { TPph21Tables } from '../utils/pph21';
import type { Pph21TableService } from './pph21-table.service';
import type { TaxNumberingService } from './tax-numbering.service';

export type { TPph21Tables } from '../utils/pph21';
export { annualPph21, applyRate, ptkpFor, terRateFor } from '../utils/pph21';

/** What another module may read about a tax rate row. */
export type TTaxSnapshot = { id: string; code: string; taxType: string; rate: string };

/**
 * The tax module's contract for other modules (ERP-0140).
 *
 * @remarks
 * Payment validates a withholding's tax and records it here inside its own
 * execute transaction; finance reverses it when an executed payment is
 * voided. Nothing else may write `tax.withholding_tax_records`.
 */
@injectable()
export class ExportedTaxService {
	constructor(
		@inject(TAX_REPOSITORY_TOKEN)
		private readonly repo: Pick<TTaxRepository, 'findTaxTypeById' | 'insertWithholding' | 'reverseWithholdingBySource'>,
		@inject(TAX_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<TaxNumberingService, 'next'>,
		/** ERP-0138: PPh 21 tables for payroll; optional so older callers need not wire it. */
		@inject(PPH21_TABLE_SERVICE_TOKEN) private readonly pph21?: Pick<Pph21TableService, 'tables'>,
	) {}

	/** The PPh 21 tables in force on a business date (payroll, ERP-0138). */
	pph21Tables(date: string): Promise<TPph21Tables> {
		if (!this.pph21) throw new Error('PPh 21 tables are not wired');
		return this.pph21.tables(date);
	}

	async findTax(organizationId: string, id: string): Promise<TTaxSnapshot | null> {
		const row = await this.repo.findTaxTypeById(organizationId, id);
		return row ? { id: row.id, code: row.code, taxType: row.taxType, rate: row.rate } : null;
	}

	async recordWithholding(
		tx: TTx,
		input: {
			organizationId: string;
			taxTypeId: string;
			counterpartyType: string | null;
			counterpartyId: string | null;
			counterpartyTaxId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string;
			taxObjectCode: string | null;
			sourceModule: string;
			sourceId: string;
		},
	): Promise<void> {
		const [year, month] = input.transactionDate.split('-').map(Number);
		const code = await this.numbering.next('withholding_tax_record', {
			date: new Date(`${input.transactionDate}T12:00:00+07:00`),
			tx,
		});
		await this.repo.insertWithholding({ ...input, code, periodYear: year, periodMonth: month }, tx);
	}

	reverseWithholdingBySource(tx: TTx, organizationId: string, sourceModule: string, sourceId: string): Promise<void> {
		return this.repo.reverseWithholdingBySource(organizationId, sourceModule, sourceId, tx);
	}
}
