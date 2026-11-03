import { describe, expect, test } from 'bun:test';
import { pageWindow } from '../../src/components/pagination/pagination-controls';

describe('pageWindow', () => {
	test('renders every page when totalPages is small', () => {
		expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
		expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	test('clamps the window at the start', () => {
		expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, 'ellipsis', 12]);
		expect(pageWindow(2, 12)).toEqual([1, 2, 3, 4, 'ellipsis', 12]);
	});

	test('centers the window mid-range', () => {
		expect(pageWindow(6, 12)).toEqual([
			1,
			'ellipsis',
			5,
			6,
			7,
			'ellipsis',
			12,
		]);
	});

	test('clamps the window at the end', () => {
		expect(pageWindow(11, 12)).toEqual([1, 'ellipsis', 10, 11, 12]);
		expect(pageWindow(12, 12)).toEqual([1, 'ellipsis', 10, 11, 12]);
	});
});
