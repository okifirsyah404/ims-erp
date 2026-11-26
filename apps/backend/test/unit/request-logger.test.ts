/**
 * The access log never throws: a malformed request URL used to raise
 * `TypeError: Invalid URL` inside the `onError` microtask and exit the
 * process (found 2026-11-24 during the ERP-0117 review).
 */
import { describe, expect, test } from 'bun:test';
import { pathOf } from '../../src/providers/logger/request-logger';

describe('request logger path', () => {
	test('a normal URL gives its path without the query', () => {
		expect(pathOf('http://localhost:3001/human-resources/employees?page=2')).toBe('/human-resources/employees');
	});

	test('a URL that does not parse is logged, not thrown', () => {
		expect(() => pathOf('/relative/path?x=1')).not.toThrow();
		expect(pathOf('/relative/path?x=1')).toBe('/relative/path');
		expect(pathOf('http://[bad')).toBe('http://[bad');
		expect(pathOf('')).toBe('(invalid url)');
	});
});
