import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType, TNumberContext } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { ProcurementCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the procurement schema (`purchase_request`,
 * `purchase_order`, `goods_receipt`, `purchase_return`).
 *
 * @remarks
 * Reads the `{COMPANY}` token from `ExportedCompanyService` and allocates in
 * `procurement.code_numberings`. The PO format also takes the `{SUPPLIER}` and
 * `{CATEGORY}` context tokens.
 */
@injectable()
export class ProcurementNumberingService {
	constructor(
		@inject(PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<ProcurementCodeNumberingRepository, 'next'>,
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
