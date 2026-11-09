import { describe, expect, test } from 'bun:test';
import { formatBusinessDate, formatIdr, rupiahToMinor } from '../../src/lib/format';
import { previewLineTotal, previewTotals } from '../../src/lib/quotation-api';
import { terbilangRupiah } from '../../src/lib/terbilang';

describe('quotation previews (mirror the server rules)', () => {
	test('a fractional quantity rounds half-up; the discount is taken off the line', () => {
		expect(previewLineTotal({ quantity: '12.5', unitPrice: 10_001, discountAmount: 0 })).toBe(125_013);
		expect(previewLineTotal({ quantity: '2', unitPrice: 150_000_00, discountAmount: 10_000_00 })).toBe(290_000_00);
	});

	test('11% VAT on subtotal minus discounts', () => {
		const line = { itemId: null, name: 'x', specification: null, unit: 'pcs' as const };
		const totals = previewTotals([{ ...line, quantity: '3', unitPrice: 333_33, discountAmount: 0 }], true, 1100);
		expect(totals).toEqual({ subtotal: 999_99, discountTotal: 0, taxTotal: 110_00, grandTotal: 1_109_99 });
		expect(previewTotals([{ ...line, quantity: '1', unitPrice: 100, discountAmount: 0 }], false, 1100).taxTotal).toBe(0);
	});
});

describe('document helpers', () => {
	test('terbilang in Indonesian, with sen only when present', () => {
		expect(terbilangRupiah(3_330_000_000)).toBe('Tiga puluh tiga juta tiga ratus ribu rupiah');
		expect(terbilangRupiah(1_000_050)).toBe('Sepuluh ribu rupiah lima puluh sen');
	});

	test('money and business dates', () => {
		expect(formatIdr(123_456_789).replace(/\s/g, ' ')).toBe('Rp 1.234.567,89');
		expect(rupiahToMinor('1234.56')).toBe(123_456);
		expect(formatBusinessDate('2026-11-05', 'id')).toBe('5 November 2026');
		expect(formatBusinessDate(null)).toBe('—');
	});
});
