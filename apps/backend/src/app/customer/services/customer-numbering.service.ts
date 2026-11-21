import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { CUSTOMER_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { CustomerCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the customer codes (`customer`, `customer_company`) and serves their
 * numbering settings.
 *
 * @remarks
 * Allocates in `customer.code_numberings`. Default pattern is
 * `{TYPE}-{SEQ:5}` (`CUS-00001`, `CMP-00001`); a code must fit 32 characters.
 */
@injectable()
export class CustomerNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'customer';

	constructor(
		@inject(CUSTOMER_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: CustomerCodeNumberingRepository,
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
	 * @throws {GeneratedCodeTooLongError} The code does not fit 32 characters
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
