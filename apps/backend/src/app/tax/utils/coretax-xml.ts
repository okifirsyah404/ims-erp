/**
 * Coretax bulk-import XML (ERP-0140, ADR-0030; grill decision 3).
 *
 * @remarks
 * Built after the DJP Coretax import templates for e-Faktur output invoices
 * (`TaxInvoiceBulk`) and unified withholding slips (`BpuBulk`) as the team
 * understood them on 2026-11-25. **The format is unverified until a test file
 * is accepted by a real Coretax import**; adjust the element names here, in
 * one place, if DJP rejects them. No DJP API is called: finance downloads the
 * file and uploads it in Coretax by hand.
 *
 * Amounts are whole rupiah with two decimals (the ERP stores minor units).
 * PPN 12% uses DPP nilai lain 11/12 (PMK 131/2024, transaction code 04), so
 * the VAT equals 11% of the selling price.
 */

export type TCoretaxInvoiceLine = {
	name: string;
	isService: boolean;
	quantity: number;
	/** Unit price, IDR minor units, before discount. */
	unitPrice: number;
	discount: number;
	/** Line tax base (DPP), IDR minor units. */
	taxBase: number;
};

export type TCoretaxInvoice = {
	date: string;
	reference: string;
	buyerTin: string | null;
	buyerName: string;
	buyerAddress: string | null;
	buyerEmail: string | null;
	lines: TCoretaxInvoiceLine[];
};

export type TCoretaxWithholding = {
	periodYear: number;
	periodMonth: number;
	counterpartyTin: string | null;
	taxObjectCode: string | null;
	taxBase: number;
	ratePercent: string;
	documentNumber: string;
	documentDate: string;
	withholdingDate: string;
};

/** Minor units to a rupiah amount string (`123456` -> `1234.56`). */
export function rupiah(minor: number): string {
	const sign = minor < 0 ? '-' : '';
	const abs = Math.abs(minor);
	return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

const el = (name: string, value: string | number | null | undefined, indent: string) =>
	value === null || value === undefined || value === '' ? `${indent}<${name}/>` : `${indent}<${name}>${escapeXml(String(value))}</${name}>`;

/** NPWP 16 digits, or null when the value is not one. */
export function normalizeTin(value: string | null | undefined): string | null {
	const digits = (value ?? '').replace(/\D/g, '');
	if (digits.length === 15) return `0${digits}`;
	return digits.length === 16 ? digits : null;
}

/** `TaxInvoiceBulk` for the output invoices of a period. */
export function buildFakturXml(sellerTin: string, invoices: readonly TCoretaxInvoice[]): string {
	const seller = normalizeTin(sellerTin) ?? sellerTin;
	const out: string[] = [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="TaxInvoice.xsd">',
		el('TIN', seller, '  '),
		'  <ListOfTaxInvoice>',
	];
	for (const invoice of invoices) {
		const buyer = normalizeTin(invoice.buyerTin);
		out.push(
			'    <TaxInvoice>',
			el('TaxInvoiceDate', invoice.date, '      '),
			el('TaxInvoiceOpt', 'Normal', '      '),
			el('TrxCode', '04', '      '),
			el('AddInfo', null, '      '),
			el('CustomDoc', null, '      '),
			el('CustomDocMonthYear', null, '      '),
			el('RefDesc', invoice.reference, '      '),
			el('FacilityStamp', null, '      '),
			el('SellerIDTKU', `${seller}000000`, '      '),
			el('BuyerTin', buyer ?? '0000000000000000', '      '),
			el('BuyerDocument', buyer ? 'TIN' : 'Other ID', '      '),
			el('BuyerCountry', 'IDN', '      '),
			el('BuyerDocumentNumber', buyer ? '-' : invoice.reference, '      '),
			el('BuyerName', invoice.buyerName, '      '),
			el('BuyerAdress', invoice.buyerAddress, '      '),
			el('BuyerEmail', invoice.buyerEmail, '      '),
			el('BuyerIDTKU', buyer ? `${buyer}000000` : '000000', '      '),
			'      <ListOfGoodService>',
		);
		for (const line of invoice.lines) {
			const otherBase = Math.round((line.taxBase * 11) / 12);
			const vat = Math.round((otherBase * 12) / 100);
			out.push(
				'        <GoodService>',
				el('Opt', line.isService ? 'B' : 'A', '          '),
				el('Code', '000000', '          '),
				el('Name', line.name, '          '),
				el('Unit', line.isService ? 'UM.0030' : 'UM.0018', '          '),
				el('Price', rupiah(line.unitPrice), '          '),
				el('Qty', line.quantity, '          '),
				el('TotalDiscount', rupiah(line.discount), '          '),
				el('TaxBase', rupiah(line.taxBase), '          '),
				el('OtherTaxBase', rupiah(otherBase), '          '),
				el('VATRate', 12, '          '),
				el('VAT', rupiah(vat), '          '),
				el('STLGRate', 0, '          '),
				el('STLG', '0.00', '          '),
				'        </GoodService>',
			);
		}
		out.push('      </ListOfGoodService>', '    </TaxInvoice>');
	}
	out.push('  </ListOfTaxInvoice>', '</TaxInvoiceBulk>');
	return `${out.join('\n')}\n`;
}

/** `BpuBulk` (bukti potong unifikasi, PPh 23 / 4(2)) for a period. */
export function buildBupotXml(sellerTin: string, rows: readonly TCoretaxWithholding[]): string {
	const seller = normalizeTin(sellerTin) ?? sellerTin;
	const out: string[] = [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<BpuBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
		el('TIN', seller, '  '),
		'  <ListOfBpu>',
	];
	for (const row of rows) {
		const tin = normalizeTin(row.counterpartyTin);
		out.push(
			'    <Bpu>',
			el('TaxPeriodMonth', row.periodMonth, '      '),
			el('TaxPeriodYear', row.periodYear, '      '),
			el('CounterpartTin', tin, '      '),
			el('IDPlaceOfBusinessActivityOfIncomeRecipient', tin ? `${tin}000000` : null, '      '),
			el('TaxCertificate', 'N/A', '      '),
			el('TaxObjectCode', row.taxObjectCode, '      '),
			el('TaxBase', rupiah(row.taxBase), '      '),
			el('Rate', row.ratePercent, '      '),
			el('Document', 'PaymentProof', '      '),
			el('DocumentNumber', row.documentNumber, '      '),
			el('DocumentDate', row.documentDate, '      '),
			el('IDPlaceOfBusinessActivity', `${seller}000000`, '      '),
			el('WithholdingDate', row.withholdingDate, '      '),
			'    </Bpu>',
		);
	}
	out.push('  </ListOfBpu>', '</BpuBulk>');
	return `${out.join('\n')}\n`;
}

/** One employee line of the monthly BP21 (bukti potong PPh 21 bulanan). */
export type TCoretaxBp21 = {
	periodYear: number;
	periodMonth: number;
	/** NPWP or NIK of the employee. */
	counterpartyTin: string;
	ptkpStatus: string;
	taxObjectCode: string;
	/** TER base in minor units. */
	gross: number;
	ratePercent: string;
	withholdingDate: string;
};

/**
 * Monthly BP21 for permanent employees (`MmPayrollBulk`, ERP-0138).
 *
 * @remarks
 * Built from the Coretax BPMP import template as we understood it; the
 * layout is unverified until a test import succeeds.
 */
export function buildBp21Xml(sellerTin: string, rows: readonly TCoretaxBp21[]): string {
	const seller = normalizeTin(sellerTin) ?? sellerTin;
	const out: string[] = [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<MmPayrollBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
		el('TIN', seller, '  '),
		'  <ListOfMmPayroll>',
	];
	for (const row of rows) {
		const tin = normalizeTin(row.counterpartyTin) ?? row.counterpartyTin;
		out.push(
			'    <MmPayroll>',
			el('TaxPeriodMonth', row.periodMonth, '      '),
			el('TaxPeriodYear', row.periodYear, '      '),
			el('CounterpartOpt', 'Resident', '      '),
			el('CounterpartPassport', null, '      '),
			el('CounterpartTin', tin, '      '),
			el('StatusTaxExemption', row.ptkpStatus, '      '),
			el('Position', 'Pegawai', '      '),
			el('TaxCertificate', 'N/A', '      '),
			el('TaxObjectCode', row.taxObjectCode, '      '),
			el('Gross', rupiah(row.gross), '      '),
			el('Rate', row.ratePercent, '      '),
			el('IDPlaceOfBusinessActivity', `${seller}000000`, '      '),
			el('WithholdingDate', row.withholdingDate, '      '),
			'    </MmPayroll>',
		);
	}
	out.push('  </ListOfMmPayroll>', '</MmPayrollBulk>');
	return `${out.join('\n')}\n`;
}
