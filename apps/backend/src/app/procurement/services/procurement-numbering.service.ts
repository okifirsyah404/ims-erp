import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { ExportedOrganizationService } from '@app/organization/services/exported-organization.service';
import { EXPORTED_SUPPLIER_SERVICE_TOKEN } from '@app/supplier';
import type { ExportedSupplierService } from '@app/supplier';
import type { CodeType, TIssueOptions, TNumberContext, TPreviewHint } from '@shared/numbering';
import { CodeNumberingServiceBase, PREVIEW_CONTEXT } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { ProcurementCodeNumberingRepository } from '../repositories/code-numbering.repository';

/**
 * Issues the codes of the procurement schema (`purchase_request`,
 * `purchase_order`, `goods_receipt`, `purchase_return`) and serves their
 * numbering settings.
 *
 * @remarks
 * Allocates in `procurement.code_numberings`. The PO format also takes the
 * `{SUPPLIER}` and `{CATEGORY}` context tokens.
 */
@injectable()
export class ProcurementNumberingService extends CodeNumberingServiceBase {
	protected readonly schema = 'procurement';

	constructor(
		@inject(PROCUREMENT_CODE_NUMBERING_REPOSITORY_TOKEN)
		numberings: ProcurementCodeNumberingRepository,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
		@inject(EXPORTED_ORGANIZATION_SERVICE_TOKEN)
		organizations?: Pick<ExportedOrganizationService, 'requireOrganizationCode'>,
		/** P7-5 (K6): real supplier codes for the PO preview; optional for older tests. */
		@inject(EXPORTED_SUPPLIER_SERVICE_TOKEN)
		private readonly suppliers?: Pick<ExportedSupplierService, 'findLongestCompanyCode' | 'assertActiveCompany'>,
	) {
		super(numberings, company, organizations);
	}

	/**
	 * The PO preview renders `{SUPPLIER}` with a real code: the supplier in
	 * `hint` when the owner picked one, else the longest live supplier code,
	 * so a PO number that would not fit shows up here instead of failing at
	 * approval (K6). Without suppliers the placeholder stays.
	 */
	protected override async previewContext(codeType: CodeType, hint: TPreviewHint = {}): Promise<TNumberContext> {
		if (codeType !== 'purchase_order' || !this.suppliers) return PREVIEW_CONTEXT;
		const supplier = hint.supplierCompanyId
			? (await this.suppliers.assertActiveCompany(hint.supplierCompanyId)).code
			: await this.suppliers.findLongestCompanyCode();
		return supplier ? { ...PREVIEW_CONTEXT, supplier } : PREVIEW_CONTEXT;
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
