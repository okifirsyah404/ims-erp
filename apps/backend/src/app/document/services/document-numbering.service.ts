import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { DOCUMENT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { DocumentCodeNumberingRepository } from '../repositories/code-numbering.repository';

/** Issues the document codes (`document`) from `document.code_numberings` and serves their settings. */
@injectable()
export class DocumentNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'document';

	constructor(
		@inject(DOCUMENT_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: DocumentCodeNumberingRepository,
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
		organizationId?: string | null,
	): Promise<string> {
		return this.issue(codeType, { tx, date, organizationId });
	}
}
