import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { InventoryCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the inventory schema (`item_product`, `stock_movement`, ...).
 *
 * @remarks
 * Reads the `{COMPANY}` token from `ExportedCompanyService` and allocates in
 * `inventory.code_numberings`, joining the caller's transaction when given so a
 * rolled-back movement leaves no gap in the sequence.
 */
@injectable()
export class InventoryNumberingService {
	constructor(
		@inject(INVENTORY_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<InventoryCodeNumberingRepository, 'next'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
	) {}

	/**
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 */
	async next(codeType: CodeType, tx?: TTx, date: Date = new Date()): Promise<string> {
		return this.numberings.next(codeType, await this.company.requireDocumentCode(tx), date, tx);
	}
}
