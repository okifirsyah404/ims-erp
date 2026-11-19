import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { CompanyService } from '@app/company/services/company.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import { appConfig } from '@config/providers/config';
import { pinoLogger } from '@providers/logger/logger';
import { type IPdfRenderer, PDF_RENDERER_TOKEN } from '@providers/pdf/pdf-renderer';
import { createRenderToken, verifyRenderToken } from '@providers/pdf/render-token';
import { inject, injectable } from 'tsyringe';
import { QUOTATION_SERVICE_TOKEN } from '../constants/di';
import type { QuotationService, TQuotationContext, TQuotationDetail } from './quotation.service';

/** The print view's render kind (token scope). */
export const QUOTATION_RENDER_KIND = 'quotation';

/** Sees every quotation; used only by this system flow. */
const SYSTEM_CONTEXT: TQuotationContext = { actorUserId: 'system', canViewAll: true, canViewDeals: true };

export type TQuotationPdfLink = { url: string; fileName: string; expiresAt: string | null };

/**
 * Delivers a sent quotation (ERP-0067, owner decisions 2026-11-17): renders
 * the SPH print view to a PDF, keeps it as a file of the quotation's registry
 * document, opens a 30-day public link, and publishes `quotation.sent` with
 * that link so n8n can send the PDF to the customer.
 *
 * @remarks
 * Runs in the `quotation-sent` queue, never in the HTTP request. A render
 * failure is retried by the queue; the last attempt publishes the event
 * without the PDF rather than not at all. The outbox dedupe key keeps one
 * event per sending.
 */
@injectable()
export class QuotationDeliveryService {
	constructor(
		@inject(QUOTATION_SERVICE_TOKEN)
		private readonly quotations: Pick<QuotationService, 'get'>,
		@inject(COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<CompanyService, 'get'>,
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'attachGeneratedFile' | 'createShare'>,
		@inject(PDF_RENDERER_TOKEN)
		private readonly renderer: IPdfRenderer,
		@inject(USER_SERVICE_TOKEN)
		private readonly users: Pick<UserService, 'getUser'>,
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	/**
	 * What the public print view shows, when its render token is valid; `null`
	 * otherwise (the controller answers 404).
	 */
	async renderData(id: string, token: string): Promise<{ quotation: TQuotationDetail; profile: unknown } | null> {
		if (!verifyRenderToken(QUOTATION_RENDER_KIND, id, token)) return null;
		const [quotation, profile] = await Promise.all([this.quotations.get(SYSTEM_CONTEXT, id), this.company.get()]);
		return { quotation, profile };
	}

	/** Renders, stores and shares the PDF; `null` when PDFs are not configured. */
	private async pdfLink(quotation: TQuotationDetail): Promise<TQuotationPdfLink | null> {
		if (!this.renderer.configured || !appConfig.pdf.renderBaseUrl || !appConfig.app.url) return null;
		const token = createRenderToken(QUOTATION_RENDER_KIND, quotation.id);
		const url = `${appConfig.pdf.renderBaseUrl.replace(/\/+$/, '')}/print/quotations/${quotation.id}?token=${encodeURIComponent(token)}`;
		const bytes = await this.renderer.render(url);
		const fileName = `${(quotation.code ?? 'penawaran').replace(/[^\w.-]+/g, '-')}.pdf`;
		const actor = quotation.sentBy ?? quotation.createdBy ?? null;
		const documentId = await this.documents.attachGeneratedFile(
			{ module: 'sale', sourceType: 'quotation', sourceId: quotation.id },
			new File([new Uint8Array(bytes)], fileName, { type: 'application/pdf' }),
			actor,
		);
		if (!documentId) return null;
		const share = await this.documents.createShare(documentId, appConfig.pdf.linkDays, actor);
		return {
			url: `${appConfig.app.url.replace(/\/+$/, '')}/public/v1/documents/${share.token}/file`,
			fileName,
			expiresAt: share.expiresAt,
		};
	}

	/**
	 * Delivers one sending of a quotation. `finalAttempt` publishes without the
	 * PDF when rendering keeps failing.
	 */
	async deliver(id: string, finalAttempt: boolean): Promise<void> {
		const quotation = await this.quotations.get(SYSTEM_CONTEXT, id);
		if (quotation.status !== 'sent' || !quotation.sentAt) return;
		let pdf: TQuotationPdfLink | null = null;
		try {
			pdf = await this.pdfLink(quotation);
		} catch (error) {
			if (!finalAttempt) throw error;
			pinoLogger.error({ err: error, quotationId: id }, 'quotation PDF not rendered; quotation.sent goes out without it');
		}
		const owner = quotation.createdBy ? await this.users.getUser(quotation.createdBy).catch(() => null) : null;
		const customer = quotation.customerSnapshot;
		await this.outbox.publish(
			'quotation.sent',
			{ type: 'quotation', id },
			{
				quotationId: id,
				code: quotation.code,
				title: quotation.title,
				sentAt: quotation.sentAt.toISOString(),
				validUntil: quotation.validUntil,
				grandTotal: quotation.grandTotal,
				currencyCode: quotation.currencyCode,
				customer: { id: quotation.customerId, name: customer.name, email: customer.email, phone: customer.phone, whatsapp: customer.whatsapp },
				owner: quotation.createdBy ? { userId: quotation.createdBy, name: owner?.name ?? null, phone: owner?.phone ?? null, email: owner?.email ?? null } : null,
				pdf,
			},
			{ dedupeKey: `quotation.sent:${id}:${quotation.sentAt.getTime()}` },
		);
	}
}
