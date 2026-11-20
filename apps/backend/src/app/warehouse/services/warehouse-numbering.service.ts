import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { WarehouseCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the warehouse schema (`warehouse`).
 *
 * @remarks
 * Reads the `{COMPANY}` token from `ExportedCompanyService` and allocates in
 * `warehouse.code_numberings`. Default pattern is `{TYPE}-{COMPANY}-{SEQ:4}`
 * (ADR-0026), e.g. `WH-IMS-0001`.
 */
@injectable()
export class WarehouseNumberingService {
	constructor(
		@inject(WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<WarehouseCodeNumberingRepository, 'next'>,
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
