/**
 * Purchase order `{{placeholders}}` (ERP-0165): validation on save and the
 * values a print resolves them to.
 */
import { describe, expect, test } from 'bun:test';
import { findInvalidPoPlaceholders, renderPoPlaceholders, type TPoPlaceholderValues } from '@ims-erp/common';

const values: TPoPlaceholderValues = {
	code: 'PO/IMS-HIT/HW/1026/001',
	orderDate: '2026-10-28',
	expectedDeliveryDate: null,
	subject: 'Pembelian Hardware',
	supplierName: 'PT HIT INTERNATIONAL',
	supplierQuoteRef: '107/10-26/IMS/RH/00',
	supplierQuoteDate: '2026-10-27',
	projectName: 'Hardware',
	buyerPicName: 'Mustaqim',
	companyName: 'CV INTI MULTI SOLUSI',
	subtotal: 13_230_000_000,
	taxTotal: 0,
	grandTotal: 13_230_000_000,
	vatRateBps: 1100,
};

describe('purchase order placeholders', () => {
	test('the sample down payment line resolves to the printed amounts', () => {
		expect(
			renderPoPlaceholders(
				'Pembayaran: DP 50% sebesar {{grand_total_pct:50}}; pelunasan 50% sebesar {{grand_total_rest:50}} sebelum barang dikirimkan.',
				values,
			),
		).toBe('Pembayaran: DP 50% sebesar Rp66.150.000; pelunasan 50% sebesar Rp66.150.000 sebelum barang dikirimkan.');
	});

	test('a share and its rest always add up to the total', () => {
		const odd = { ...values, grandTotal: 100_001 };
		expect(renderPoPlaceholders('{{grand_total_pct:33.33}} + {{grand_total_rest:33,33}}', odd)).toBe('Rp333,30 + Rp666,71');
	});

	test('text and dates; an unset value prints as a dash', () => {
		expect(
			renderPoPlaceholders('{{ po_number }} {{order_date}} {{expected_delivery_date}} {{supplier_name}} {{vat_rate}}', values),
		).toBe('PO/IMS-HIT/HW/1026/001 28 Oktober 2026 - PT HIT INTERNATIONAL 11%');
	});

	test('unknown or malformed placeholders are reported and left as written', () => {
		const text = '{{dp}} {{grand_total_pct}} {{grand_total_pct:150}} {{grand_total:5}} {{grand_total}} {{dp}}';
		expect(findInvalidPoPlaceholders(text)).toEqual(['{{dp}}', '{{grand_total_pct}}', '{{grand_total_pct:150}}', '{{grand_total:5}}']);
		expect(renderPoPlaceholders(text, values)).toBe(
			'{{dp}} {{grand_total_pct}} {{grand_total_pct:150}} {{grand_total:5}} Rp132.300.000 {{dp}}',
		);
		expect(findInvalidPoPlaceholders('Garansi 12 bulan; {{grand_total_rest:10}}')).toEqual([]);
		expect(findInvalidPoPlaceholders('{{dp_50}} {{Grand Total}} {{}}')).toEqual(['{{dp_50}}', '{{Grand Total}}', '{{}}']);
		expect(findInvalidPoPlaceholders(null)).toEqual([]);
	});
});
