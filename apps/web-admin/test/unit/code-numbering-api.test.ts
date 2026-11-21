import { describe, expect, mock, test } from 'bun:test';

// The client module reads the UI language for `Accept-Language`; the i18n
// bootstrap is not needed for the pure visibility helpers.
mock.module('@/i18n', () => ({ currentLanguage: () => 'en' }));

const { CODE_NUMBERING_SECTIONS, canEditSection, canSeeSection } = await import(
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
