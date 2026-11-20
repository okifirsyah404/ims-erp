import { COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { CompanyService } from '@app/company/services/company.service';
import type { TWarrantyCertificateSelect } from '@drizzle/schemas/aftersales.schema';
import { verifyRenderToken } from '@providers/pdf/render-token';
import { inject, injectable } from 'tsyringe';
import { WARRANTY_REPOSITORY_TOKEN } from '../constants/di';
import type { IWarrantyRepository } from '../contracts/warranty.contract';

/** Render kind of the warranty certificate print view (ERP-0079). */
export const WARRANTY_RENDER_KIND = 'warranty';

/**
 * Data for the public warranty-certificate print view the PDF renderer opens
 * (ERP-0079): the certificate and the company profile, behind a short-lived
 * render token instead of a session.
 */
@injectable()
export class WarrantyRenderService {
	constructor(
		@inject(WARRANTY_REPOSITORY_TOKEN) private readonly certificates: Pick<IWarrantyRepository, 'findById'>,
		@inject(COMPANY_SERVICE_TOKEN) private readonly company: Pick<CompanyService, 'get'>,
	) {}

	/** `null` when the token is wrong or expired, or the certificate is gone (the controller answers 404). */
	async renderData(id: string, token: string): Promise<{ warranty: TWarrantyCertificateSelect; profile: unknown } | null> {
		if (!verifyRenderToken(WARRANTY_RENDER_KIND, id, token)) return null;
		const [warranty, profile] = await Promise.all([this.certificates.findById(id), this.company.get(false)]);
		return warranty ? { warranty, profile } : null;
	}
}
