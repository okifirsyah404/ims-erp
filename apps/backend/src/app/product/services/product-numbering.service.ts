import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { ProductCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the product schema (`item_product`, `item_material`,
 * `item_component`).
 *
 * @remarks
 * Reads the `{COMPANY}` token from `ExportedCompanyService` and allocates in
 * `product.code_numberings`, joining the caller's transaction when given so a
 * rolled-back product leaves no gap in the sequence. Default pattern is
 * `{TYPE}-{COMPANY}-{SEQ:5}` (ADR-0026), e.g. `PRD-IMS-00001`.
 */
@injectable()
export class ProductNumberingService {
	constructor(
		@inject(PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<ProductCodeNumberingRepository, 'next'>,
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
