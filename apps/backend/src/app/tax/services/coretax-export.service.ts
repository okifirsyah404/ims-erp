import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import { EXPORTED_PRODUCT_SERVICE_TOKEN } from '@app/product/constants/di';
import type { ExportedProductService } from '@app/product/services/exported-product.service';
import { EXPORTED_INVOICE_SERVICE_TOKEN } from '@app/sale/constants/ar-di';
import type { IExportedInvoiceService } from '@app/sale/contracts/exported-invoice.contract';
import { inject, injectable } from 'tsyringe';
import { TAX_REPOSITORY_TOKEN } from '../constants/di';
import type { TTaxRepository } from '../contracts/tax.repository.interface';
import { WithholdingNotFoundError } from '../errors/tax.errors';
import { buildBupotXml, buildFakturXml, type TCoretaxInvoice } from '../utils/coretax-xml';

const monthRange = (year: number, month: number) => ({
	start: `${year}-${String(month).padStart(2, '0')}-01`,
	end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
});

/**
 * Coretax XML files for manual upload (ERP-0140, grill decision 3): output
 * invoices of a period (`TaxInvoiceBulk`) and the period's withholding slips
 * (`BpuBulk`). The tax module owns the export; it reads invoices through the
 * sale contract and the seller NPWP from the company profile.
 */
@injectable()
export class CoretaxExportService {
	constructor(
		@inject(TAX_REPOSITORY_TOKEN)
		private readonly repo: Pick<TTaxRepository, 'listWithholdingsForPeriod' | 'updateWithholdingCoretax' | 'findTaxTypeById'>,
		@inject(EXPORTED_INVOICE_SERVICE_TOKEN) private readonly invoices: Pick<IExportedInvoiceService, 'listTaxInvoices'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN) private readonly company: Pick<ExportedCompanyService, 'getLetterhead'>,
		@inject(EXPORTED_PRODUCT_SERVICE_TOKEN) private readonly products: Pick<ExportedProductService, 'productsById'>,
	) {}

	private async sellerTin(): Promise<string> {
		return (await this.company.getLetterhead())?.taxId ?? '';
	}

	async fakturXml(organizationId: string, year: number, month: number): Promise<{ xml: string; count: number }> {
		const { start, end } = monthRange(year, month);
		const rows = await this.invoices.listTaxInvoices(organizationId, start, end);
		const productIds = [...new Set(rows.flatMap((row) => row.items.map((item) => item.productId)).filter((id): id is string => !!id))];
		const products = productIds.length ? await this.products.productsById(productIds) : new Map();
		const invoices: TCoretaxInvoice[] = rows.map(({ invoice, items }) => ({
			date: invoice.issueDate ?? start,
			reference: invoice.code ?? invoice.id,
			buyerTin: invoice.customerSnapshot?.taxId ?? null,
			buyerName: invoice.customerSnapshot?.name ?? '-',
			buyerAddress: invoice.customerSnapshot?.addressLine ?? null,
			buyerEmail: invoice.customerSnapshot?.email ?? null,
			lines: items.map((item) => {
				const quantity = Number(item.quantity);
				return {
					name: item.description ?? products.get(item.productId ?? '')?.name ?? '-',
					// A line without a stock product is a service (instalasi, maintenance, termin).
					isService: !item.productId || !products.get(item.productId)?.isStockTracked,
					quantity,
					unitPrice: item.unitPrice,
					discount: item.discountAmount,
					taxBase: Math.max(0, item.lineTotal - item.taxAmount),
				};
			}),
		}));
		return { xml: buildFakturXml(await this.sellerTin(), invoices), count: invoices.length };
	}

	async bupotXml(organizationId: string, year: number, month: number): Promise<{ xml: string; count: number }> {
		const rows = await this.repo.listWithholdingsForPeriod(organizationId, year, month);
		const xmlRows = await Promise.all(
			rows.map(async (row) => {
				const tax = await this.repo.findTaxTypeById(organizationId, row.taxTypeId);
				const date = row.transactionDate ?? `${year}-${String(month).padStart(2, '0')}-01`;
				return {
					periodYear: year,
					periodMonth: month,
					counterpartyTin: row.counterpartyTaxId,
					taxObjectCode: row.taxObjectCode,
					taxBase: row.baseAmount,
					ratePercent: tax ? String(Number(tax.rate)) : '0',
					documentNumber: row.code,
					documentDate: date,
					withholdingDate: date,
				};
			}),
		);
		return { xml: buildBupotXml(await this.sellerTin(), xmlRows), count: xmlRows.length };
	}

	async updateCoretax(
		organizationId: string,
		id: string,
		patch: { coretaxStatus?: string; withholdingSlipNumber?: string | null; counterpartyTaxId?: string | null; taxObjectCode?: string | null },
	) {
		const row = await this.repo.updateWithholdingCoretax(organizationId, id, patch);
		if (!row) throw new WithholdingNotFoundError();
		return row;
	}
}
