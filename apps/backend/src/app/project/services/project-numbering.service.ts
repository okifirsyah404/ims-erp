import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { TTx } from '@drizzle/types';
import type { CodeType, TNumberContext } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { ProjectCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the project schema (`project`, `bast`, `web_rfq`, ...) and
 * serves their numbering settings.
 *
 * @remarks
 * Allocates in `project.code_numberings`, joining the caller's transaction when
 * given. Warranty certificates take the `{CUSTOMER}` context token.
 */
@injectable()
export class ProjectNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'project';

	constructor(
		@inject(PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: ProjectCodeNumberingRepository,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
		@inject(EXPORTED_ORGANIZATION_SERVICE_TOKEN)
		organizations?: Pick<ExportedOrganizationService, 'requireOrganizationCode'>,
	) {
		super(numberings, company, organizations);
	}

	/**
	 * @param organizationId - Issuing organization, for the `{ORG}` token
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 * @throws {OrganizationRequiredForCodeError} The pattern uses `{ORG}` without an organization
	 */
	async next(
		codeType: CodeType,
		tx?: TTx,
		date: Date = new Date(),
		context?: TNumberContext,
		organizationId?: string | null,
	): Promise<string> {
		return this.issue(codeType, { tx, date, context, organizationId });
	}
}
