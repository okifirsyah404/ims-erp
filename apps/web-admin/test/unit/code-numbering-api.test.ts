import { describe, expect, mock, test } from 'bun:test';

// The client module reads the UI language for `Accept-Language`; the i18n
// bootstrap is not needed for the pure visibility helpers.
mock.module('@/i18n', () => ({ currentLanguage: () => 'en' }));

const { CODE_NUMBERING_SECTIONS, canEditSection, canSeeSection, exceedsMaxLength, previewCodeNumber, usesSupplierToken } = await import(
	'../../src/lib/code-numbering-api'
);

const warehouse = CODE_NUMBERING_SECTIONS.find((section) => section.schema === 'warehouse')!;
const sale = CODE_NUMBERING_SECTIONS.find((section) => section.schema === 'sale')!;

describe('code numbering sections', () => {
	test('list every schema that owns a code_numberings table, once', () => {
		const schemas = CODE_NUMBERING_SECTIONS.map((section) => section.schema);
		expect(new Set(schemas).size).toBe(schemas.length);
		expect([...schemas].sort()).toEqual(
			[
				'customer',
				'document',
				'finance',
				'human_resource',
				'inventory',
				'payment',
				'procurement',
				'product',
				'project',
				'sale',
				'supplier',
				'tax',
				'ticket',
				'warehouse',
			].sort(),
		);
	});

	test('a member without code_number.read sees nothing', () => {
		const visible = CODE_NUMBERING_SECTIONS.filter((section) =>
			canSeeSection(section, { isAppAdmin: false, canRead: false }),
		);
		expect(visible).toEqual([]);
	});

	test('code_number.read shows every section except the app-admin-only warehouse', () => {
		const access = { isAppAdmin: false, canRead: true };
		expect(canSeeSection(sale, access)).toBe(true);
		expect(canSeeSection(warehouse, access)).toBe(false);
	});

	test('an app admin sees and edits every section without a permission', () => {
		expect(canSeeSection(warehouse, { isAppAdmin: true, canRead: false })).toBe(true);
		expect(canEditSection(warehouse, { isAppAdmin: true, canUpdate: false })).toBe(true);
	});

	test('editing needs code_number.update', () => {
		expect(canEditSection(sale, { isAppAdmin: false, canUpdate: false })).toBe(false);
		expect(canEditSection(sale, { isAppAdmin: false, canUpdate: true })).toBe(true);
		expect(canEditSection(warehouse, { isAppAdmin: false, canUpdate: true })).toBe(false);
	});
});

describe('PO preview with a supplier context (P7-5)', () => {
	const procurement = CODE_NUMBERING_SECTIONS.find((section) => section.schema === 'procurement')!;

	test('a number over its column is flagged; an unlimited series never is', () => {
		expect(exceedsMaxLength('PO/IMS-DEV-ENTRAGATE-SUP-00001/HW/1126/001', 32)).toBe(true);
		expect(exceedsMaxLength('PO/IMS-SUP-00001/HW/1126/001', 32)).toBe(false);
		expect(exceedsMaxLength('X'.repeat(80), null)).toBe(false);
	});

	test('only patterns with {SUPPLIER} show the supplier note', () => {
		expect(usesSupplierToken('{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}')).toBe(true);
		expect(usesSupplierToken('{SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}')).toBe(false);
	});

	test('the preview sends the chosen supplier and returns the sample it used', async () => {
		const sent: { url: string; body: unknown }[] = [];
		const original = globalThis.fetch;
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
			return new Response(
				JSON.stringify({
					requestId: 'r',
					status: 200,
					message: 'OK',
					timestamp: 0,
					data: { nextNumber: 'PO/IMS-HIT/HW/1126/001', sampleContext: { supplier: 'HIT', category: 'HW' }, maxLength: 32 },
				}),
				{ status: 200 },
			);
		}) as typeof fetch;
		try {
			const pattern = { pattern: '{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}', resetPolicy: 'monthly' as const };
			const preview = await previewCodeNumber(procurement, 'purchase_order', pattern, 'supplier-1');
			expect(preview).toEqual({ nextNumber: 'PO/IMS-HIT/HW/1126/001', sampleContext: { supplier: 'HIT', category: 'HW' }, maxLength: 32 });
			expect(sent[0]!.url.endsWith('/procurement/code-numberings/purchase_order/preview')).toBe(true);
			expect(sent[0]!.body).toEqual({ ...pattern, supplierCompanyId: 'supplier-1' });
			// Without a choice the body stays the plain setting.
			await previewCodeNumber(procurement, 'purchase_order', pattern);
			expect(sent[1]!.body).toEqual(pattern);
		} finally {
			globalThis.fetch = original;
		}
	});
});
