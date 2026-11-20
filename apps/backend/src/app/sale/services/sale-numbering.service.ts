import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType, TNumberContext } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { SALE_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { SaleCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the sale schema (`quotation`, `order`, `delivery_note`,
 * `invoice`, `receipt`, `return`).
 *
 * @remarks
 * Reads the `{COMPANY}` token from `ExportedCompanyService` and allocates in
 * `sale.code_numberings`, joining the caller's transaction when given.
 */
@injectable()
export class SaleNumberingService {
	constructor(
		@inject(SALE_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<SaleCodeNumberingRepository, 'next'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
	) {}

	/**
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 */
	async next(
		codeType: CodeType,
		options: { date?: Date; context?: TNumberContext; tx?: TTx } = {},
	): Promise<string> {
		return this.numberings.next(
			codeType,
			await this.company.requireDocumentCode(options.tx),
			options.date ?? new Date(),
			options.tx,
			options.context,
		);
	}
}
