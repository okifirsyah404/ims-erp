import { describe, expect, test } from 'bun:test';
import { paginationResult } from '../../src/utils/pagination.util';

describe('paginationResult', () => {
	test('echoes page and limit and counts whole pages', () => {
		const result = paginationResult({ page: 2, limit: 20 }, 57, [{ id: 'a' }]);

		expect(result).toEqual({
			meta: { page: 2, limit: 20, total: 57, totalPages: 3 },
			data: [{ id: 'a' }],
		});
	});

	test('an empty result set reports zero pages, not one', () => {
		// The documented convention: totalPages is ceil(total / limit). Callers
		// clamp with `useClampPage`, so 0 is safe and keeps `total`/`totalPages`
		// self-consistent.
		const result = paginationResult({ page: 1, limit: 20 }, 0, []);

		expect(result.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
	});

	test('an exact multiple does not add a trailing page', () => {
		expect(paginationResult({ page: 1, limit: 20 }, 40, []).meta.totalPages).toBe(2);
	});

	test('one row over a multiple adds exactly one page', () => {
		expect(paginationResult({ page: 1, limit: 20 }, 41, []).meta.totalPages).toBe(3);
	});

	test('a single row is one page', () => {
		expect(paginationResult({ page: 1, limit: 20 }, 1, []).meta.totalPages).toBe(1);
	});

	test('returns the caller-supplied data array untouched', () => {
		const rows = [{ id: 'a' }, { id: 'b' }];
		expect(paginationResult({ page: 1, limit: 10 }, 2, rows).data).toBe(rows);
	});
});
