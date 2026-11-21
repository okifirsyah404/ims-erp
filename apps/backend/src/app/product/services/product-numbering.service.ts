import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { ProductCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the product schema (`item_product`, `item_material`,
 * `item_component`) and serves their numbering settings.
 *
 * @remarks
 * Allocates in `product.code_numberings`, joining the caller's transaction when
 * given so a rolled-back product leaves no gap in the sequence. Default pattern
 * is `{TYPE}-{COMPANY}-{SEQ:5}` (ADR-0026), e.g. `PRD-IMS-00001`.
 */
@injectable()
export class ProductNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'product';

	constructor(
		@inject(PRODUCT_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: ProductCodeNumberingRepository,
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
