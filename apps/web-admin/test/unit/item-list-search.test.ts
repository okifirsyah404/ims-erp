import { describe, expect, test } from 'bun:test';

import {
	countPopoverFilters,
	hasItemFilters,
	validateItemListSearch,
} from '../../src/lib/item-list-search';

const ID = '01920000-0000-7000-8000-000000000001';

describe('validateItemListSearch', () => {
	test('an empty search yields no params', () => {
		expect(validateItemListSearch({})).toEqual({
			page: undefined,
			q: undefined,
			categoryId: undefined,
			status: undefined,
			minPrice: undefined,
			maxPrice: undefined,
			minStock: undefined,
			maxStock: undefined,
			sortBy: undefined,
			sortDir: undefined,
		});
	});

	test('reads page, q, category, status, ranges and sort', () => {
		expect(
			validateItemListSearch({
				page: '3',
				q: '  cam ',
				categoryId: ID,
				status: 'inactive',
				minPrice: '1000',
				maxPrice: '250000.5',
				minStock: '0',
				maxStock: '12',
				sortBy: 'price',
				sortDir: 'desc',
			}),
		).toEqual({
			page: 3,
			q: 'cam',
			categoryId: ID,
			status: 'inactive',
			minPrice: 1000,
			maxPrice: 250000.5,
			minStock: 0,
			maxStock: 12,
			sortBy: 'price',
			sortDir: 'desc',
		});
	});

	test('drops junk: bad page falls back to 1, others are ignored', () => {
		const parsed = validateItemListSearch({
			page: 'x',
			q: '   ',
			categoryId: 'nope',
			status: 'archived',
			minPrice: '-5',
			maxPrice: 'abc',
			minStock: '',
			sortBy: 'popularity',
			sortDir: 'sideways',
		});
		expect(parsed.page).toBe(1);
		expect(parsed.q).toBeUndefined();
		expect(parsed.categoryId).toBeUndefined();
		expect(parsed.status).toBeUndefined();
		expect(parsed.minPrice).toBeUndefined();
		expect(parsed.maxPrice).toBeUndefined();
		expect(parsed.minStock).toBeUndefined();
		expect(parsed.sortBy).toBeUndefined();
		expect(parsed.sortDir).toBeUndefined();
	});

	test('the legacy activeOnly link still reads as status=active', () => {
		expect(validateItemListSearch({ activeOnly: 'true' }).status).toBe('active');
		expect(validateItemListSearch({ activeOnly: 'false' }).status).toBeUndefined();
	});
});

describe('filter counters', () => {
	test('hasItemFilters ignores sorting, counts ranges (0 included)', () => {
		expect(hasItemFilters({})).toBe(false);
		expect(hasItemFilters({ sortBy: 'price' })).toBe(false);
		expect(hasItemFilters({ q: 'a' })).toBe(true);
		expect(hasItemFilters({ maxStock: 0 })).toBe(true);
		expect(hasItemFilters({ status: 'active' })).toBe(true);
	});

	test('countPopoverFilters counts one per group', () => {
		expect(countPopoverFilters({})).toBe(0);
		expect(countPopoverFilters({ minPrice: 1, maxPrice: 2, minStock: 0 })).toBe(2);
		expect(countPopoverFilters({ categoryId: ID, status: 'active', sortBy: 'name' })).toBe(3);
	});
});
