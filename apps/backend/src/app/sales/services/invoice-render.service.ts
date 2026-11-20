import { COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { CompanyService } from '@app/company/services/company.service';
import { verifyRenderToken } from '@providers/pdf/render-token';
import { inject, injectable } from 'tsyringe';
import { INVOICE_BILLING_SERVICE_TOKEN, INVOICE_SERVICE_TOKEN } from '../constants/ar-di';
import type { InvoiceBillingService } from './invoice-billing.service';
import type { InvoiceService } from './invoice.service';

/** Render kind of the invoice print view (ERP-0079). */
export const INVOICE_RENDER_KIND = 'invoice';

/** The id a render token names for an invoice: invoices are organization-scoped. */
export const invoiceRenderId = (organizationId: string, invoiceId: string) => `${organizationId}:${invoiceId}`;

/**
 * Data for the public invoice print view the PDF renderer opens (ERP-0079):
 * the same invoice detail and company profile as the staff print page, behind
 * a short-lived render token instead of a session.
 */
@injectable()
export class InvoiceRenderService {
	constructor(
		@inject(INVOICE_BILLING_SERVICE_TOKEN) private readonly billing: Pick<InvoiceBillingService, 'detail'>,
		@inject(INVOICE_SERVICE_TOKEN) private readonly invoices: Pick<InvoiceService, 'get'>,
		@inject(COMPANY_SERVICE_TOKEN) private readonly company: Pick<CompanyService, 'get'>,
	) {}

	/** `null` when the token is missing, wrong or expired (the controller answers 404). */
	async renderData(organizationId: string, id: string, token: string): Promise<{ invoice: unknown; profile: unknown } | null> {
		if (!verifyRenderToken(INVOICE_RENDER_KIND, invoiceRenderId(organizationId, id), token)) return null;
		const [detail, { items }, profile] = await Promise.all([
			this.billing.detail({ organizationId, actorUserId: 'system' }, id),
			this.invoices.get(organizationId, id),
			this.company.get(false),
		]);
		return { invoice: { ...detail, items }, profile };
	}
}
