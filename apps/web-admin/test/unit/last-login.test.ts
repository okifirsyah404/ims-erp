import { describe, expect, test } from 'bun:test';
import {
	LAST_LOGIN_METHODS,
	parseLastLoginMethod,
} from '../../src/lib/last-login';

/**
 * ERP-0112: the badge value comes from a client-writable cookie, so only the
 * known methods may pass.
 */
describe('parseLastLoginMethod', () => {
	test('accepts every method the plugin can record', () => {
		for (const method of LAST_LOGIN_METHODS) {
			expect(parseLastLoginMethod(method)).toBe(method);
		}
	});

	test('ignores missing, empty and unknown values', () => {
		expect(parseLastLoginMethod(null)).toBeNull();
		expect(parseLastLoginMethod(undefined)).toBeNull();
		expect(parseLastLoginMethod('')).toBeNull();
		expect(parseLastLoginMethod('otp')).toBeNull();
		expect(parseLastLoginMethod('<script>')).toBeNull();
		expect(parseLastLoginMethod('Google')).toBeNull();
	});
});
