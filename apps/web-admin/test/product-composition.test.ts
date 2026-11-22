import { describe, expect, test } from 'bun:test';
import { parseQuantity, toCompositionDrafts, toCompositionLines } from '@/lib/product-composition';

describe('parseQuantity', () => {
	test('accepts positive numbers with up to three decimals, comma or dot', () => {
		expect(parseQuantity('2')).toBe(2);
		expect(parseQuantity('1,5')).toBe(1.5);
		expect(parseQuantity('0.125')).toBe(0.125);
	});

	test('rejects zero, negatives, text and more than three decimals', () => {
		for (const text of ['0', '-1', '', 'abc', '0.0001']) expect(parseQuantity(text)).toBeNull();
	});
});

describe('composition drafts', () => {
	const draft = (quantity: string) => ({
		componentId: 'c1',
		code: 'CMP-1',
		name: 'PSU',
		productKind: 'component' as const,
		unitLabel: 'pcs',
		quantity,
	});

	test('turns valid drafts into request lines and any invalid one into null', () => {
		expect(toCompositionLines([draft('2')])).toEqual([{ componentId: 'c1', quantity: 2 }]);
		expect(toCompositionLines([draft('2'), draft('0')])).toBeNull();
	});

	test('starts the editor from server rows, trimming the decimal string', () => {
		const [row] = toCompositionDrafts([
			{
				id: 'r1',
				componentId: 'c1',
				code: 'CMP-1',
				name: 'PSU',
				productKind: 'component',
				unitLabel: 'pcs',
				quantity: '3.000',
				sortOrder: 0,
				isArchived: false,
			},
		]);
		expect(row?.quantity).toBe('3');
	});
});
