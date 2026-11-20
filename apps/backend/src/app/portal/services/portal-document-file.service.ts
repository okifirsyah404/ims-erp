import { WARRANTY_SERVICE_TOKEN } from '@app/aftersales/constants/di';
import { WARRANTY_RENDER_KIND } from '@app/aftersales/services/warranty-render.service';
import type { WarrantyService } from '@app/aftersales/services/warranty.service';
import { PROJECT_PORTAL_SERVICE_TOKEN } from '@app/projects/constants/di';
import type { ProjectPortalService } from '@app/projects/services/project-portal.service';
import { CUSTOMER_SALES_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { CustomerSalesService } from '@app/sales/services/customer-sales.service';
import { INVOICE_RENDER_KIND, invoiceRenderId } from '@app/sales/services/invoice-render.service';
import { QUOTATION_RENDER_KIND } from '@app/sales/services/quotation-delivery.service';
import type { PortalContext } from '@authorization/portal-auth';
import { appConfig } from '@config/providers/config';
import { type IPdfRenderer, PDF_RENDERER_TOKEN } from '@providers/pdf/pdf-renderer';
import { createRenderToken } from '@providers/pdf/render-token';
import { inject, injectable } from 'tsyringe';
import { PortalNotFoundError, PortalPdfUnavailableError } from '../errors/portal.errors';

export const PORTAL_PDF_KINDS = ['quotation', 'invoice', 'warranty'] as const;
export type TPortalPdfKind = (typeof PORTAL_PDF_KINDS)[number];

export type TPortalFile = { bytes: Uint8Array; fileName: string; contentType: string };

const fileNameOf = (code: string | null | undefined, fallback: string) => `${(code || fallback).replace(/[^\w.-]+/g, '-')}.pdf`;

/**
 * Downloads in the customer portal (ERP-0079). A PDF is rendered on request
 * from the same print view staff use (SPH, invoice, warranty certificate),
 * opened by headless Chromium with a 2-minute render token; project files are
 * read from object storage. Every download first checks that the document
 * belongs to the guard's customer (another customer's id answers 404).
 */
@injectable()
export class PortalDocumentFileService {
	constructor(
		@inject(PDF_RENDERER_TOKEN) private readonly renderer: IPdfRenderer,
		@inject(CUSTOMER_SALES_SERVICE_TOKEN) private readonly sales: Pick<CustomerSalesService, 'getQuotation' | 'getInvoice'>,
		@inject(WARRANTY_SERVICE_TOKEN) private readonly warranties: Pick<WarrantyService, 'getForCustomer'>,
		@inject(PROJECT_PORTAL_SERVICE_TOKEN) private readonly projects: Pick<ProjectPortalService, 'listForCustomer' | 'getForCustomer'>,
	) {}

	private printUrl(path: string): string {
		return `${(appConfig.pdf.renderBaseUrl ?? '').replace(/\/+$/, '')}${path}`;
	}

	private async render(path: string, fileName: string): Promise<TPortalFile> {
		if (!this.renderer.configured || !appConfig.pdf.renderBaseUrl) throw new PortalPdfUnavailableError();
		const bytes = await this.renderer.render(this.printUrl(path));
		return { bytes: new Uint8Array(bytes), fileName, contentType: 'application/pdf' };
	}

	/**
	 * @throws {PortalNotFoundError} not the customer's document (or a draft SPH)
	 * @throws {PortalPdfUnavailableError} PDF rendering is not configured
	 */
	async pdf(portal: PortalContext, kind: TPortalPdfKind, id: string): Promise<TPortalFile> {
		if (kind === 'quotation') {
			const quotation = await this.sales.getQuotation(portal.customerId, id).catch(() => null);
			// A draft is still internal: sales has not sent it yet.
			if (!quotation || quotation.status === 'draft') throw new PortalNotFoundError();
			const token = createRenderToken(QUOTATION_RENDER_KIND, quotation.id);
			return this.render(`/print/quotations/${quotation.id}?token=${encodeURIComponent(token)}`, fileNameOf(quotation.code, 'penawaran'));
		}
		if (kind === 'invoice') {
			const invoice = await this.sales.getInvoice(portal.customerId, id).catch(() => null);
			if (!invoice) throw new PortalNotFoundError();
			const token = createRenderToken(INVOICE_RENDER_KIND, invoiceRenderId(invoice.organizationId, invoice.id));
			return this.render(
				`/print/invoices/${invoice.id}?org=${encodeURIComponent(invoice.organizationId)}&token=${encodeURIComponent(token)}`,
				fileNameOf(invoice.code, 'faktur'),
			);
		}
		const certificate = await this.warranties.getForCustomer(portal.customerId, id);
		if (!certificate) throw new PortalNotFoundError();
		const token = createRenderToken(WARRANTY_RENDER_KIND, certificate.id);
		return this.render(`/print/warranties/${certificate.id}?token=${encodeURIComponent(token)}`, fileNameOf(certificate.code, 'garansi'));
	}

	/** A customer-visible project file: its short-lived storage link. @throws {PortalNotFoundError} */
	async projectFileUrl(portal: PortalContext, fileId: string): Promise<string> {
		const projects = await this.projects.listForCustomer(portal.customerId);
		for (const project of projects) {
			const detail = await this.projects.getForCustomer(portal.customerId, project.id);
			const file = detail?.files.find((entry) => entry.id === fileId);
			if (file) return file.url;
		}
		throw new PortalNotFoundError();
	}
}
