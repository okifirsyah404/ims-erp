import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { TAX_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { TaxCodeNumberingRepository } from '../repositories/code-numbering.repository';

/** Issues the codes of the tax schema (`tax_record`, `withholding_tax_record`). */
@injectable()
export class TaxNumberingService {
	constructor(
		@inject(TAX_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<TaxCodeNumberingRepository, 'next'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
	) {}

	/**
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 */
	async next(codeType: CodeType, options: { date?: Date; tx?: TTx } = {}): Promise<string> {
		return this.numberings.next(
			codeType,
			await this.company.requireDocumentCode(options.tx),
			options.date ?? new Date(),
			options.tx,
		);
	}
}
