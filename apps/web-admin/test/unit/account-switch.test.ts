import { describe, expect, test } from 'bun:test';
import { accountChanged, safeRedirectPath } from '../../src/lib/account-switch';

describe('safeRedirectPath', () => {
	test('keeps same-origin paths verbatim, including search and hash', () => {
		expect(safeRedirectPath('/sales/quotes/abc?tab=lines#items')).toBe('/sales/quotes/abc?tab=lines#items');
		expect(safeRedirectPath('/')).toBe('/');
	});

	test('falls back to the root for empty or missing values', () => {
		expect(safeRedirectPath(undefined)).toBe('/');
		expect(safeRedirectPath(null)).toBe('/');
		expect(safeRedirectPath('')).toBe('/');
	});

	test('rejects anything that could leave the origin', () => {
		expect(safeRedirectPath('https://evil.example/x')).toBe('/');
		expect(safeRedirectPath('//evil.example/x')).toBe('/');
		expect(safeRedirectPath('/\\evil.example/x')).toBe('/');
		expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
		expect(safeRedirectPath('sales/quotes')).toBe('/');
	});
});

describe('accountChanged', () => {
	test('never reloads before both sides are resolved', () => {
		expect(accountChanged(undefined, 'user-a')).toBe(false);
		expect(accountChanged('user-a', undefined)).toBe(false);
	});

	test('stays put while the same account is signed in', () => {
		expect(accountChanged('user-a', 'user-a')).toBe(false);
	});

	test('reloads when another account signs in or the session ends', () => {
		expect(accountChanged('user-a', 'user-b')).toBe(true);
		expect(accountChanged('user-a', null)).toBe(true);
		expect(accountChanged(null, 'user-a')).toBe(true);
	});
});
