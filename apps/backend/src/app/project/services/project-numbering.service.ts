import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType, TNumberContext } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { ProjectCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the project schema (`web_rfq`, `lead_reference`, ...).
 *
 * @remarks
 * Reads the `{COMPANY}` token from `ExportedCompanyService` and allocates in
 * `project.code_numberings`, joining the caller's transaction when given.
 */
@injectable()
export class ProjectNumberingService {
	constructor(
		@inject(PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<ProjectCodeNumberingRepository, 'next'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
	) {}

	/**
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 */
	async next(
		codeType: CodeType,
		tx?: TTx,
		date: Date = new Date(),
		context?: TNumberContext,
	): Promise<string> {
		return this.numberings.next(codeType, await this.company.requireDocumentCode(tx), date, tx, context);
	}
}
