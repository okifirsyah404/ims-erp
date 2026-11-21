import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { CodeNumberingServiceBase } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { WarehouseCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the warehouse schema (`warehouse`) and serves their
 * numbering settings.
 *
 * @remarks
 * Allocates in `warehouse.code_numberings`. Default pattern is
 * `{TYPE}-{COMPANY}-{SEQ:4}` (ADR-0026), e.g. `WH-IMS-0001`.
 */
@injectable()
export class WarehouseNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'warehouse';

	constructor(
		@inject(WAREHOUSE_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: WarehouseCodeNumberingRepository,
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
