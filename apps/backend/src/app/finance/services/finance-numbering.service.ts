import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { CodeType, TIssueOptions } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { FINANCE_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { FinanceCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the finance schema (`journal_entry`, `supplier_bill`,
 * `cash_bank_transaction`, `bank_reconciliation`, `asset_depreciation`) and
 * serves their numbering settings.
 *
 * @remarks
 * Allocates in `finance.code_numberings`, joining the caller's transaction when given.
 */
@injectable()
export class FinanceNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'finance';

	constructor(
		@inject(FINANCE_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: FinanceCodeNumberingRepository,
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
