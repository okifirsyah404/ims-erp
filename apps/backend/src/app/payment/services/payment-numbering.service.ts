import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { CodeType, TIssueOptions } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { PaymentCodeNumberingRepository } from '../repositories/code-numbering.repository';

/** Issues the payment codes (`payment`) from `payment.code_numberings` and serves their settings. */
@injectable()
export class PaymentNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'payment';

	constructor(
		@inject(PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: PaymentCodeNumberingRepository,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
		@inject(EXPORTED_ORGANIZATION_SERVICE_TOKEN)
		organizations?: Pick<ExportedOrganizationService, 'requireOrganizationCode'>,
	) {
		super(numberings, company, organizations);
	}

	/**
	 * `options.organizationId` is the issuing organization, for the `{ORG}` token.
	 *
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 * @throws {OrganizationRequiredForCodeError} The pattern uses `{ORG}` without an organization
	 */
	async next(codeType: CodeType, options: TIssueOptions = {}): Promise<string> {
		return this.issue(codeType, options);
	}
}
