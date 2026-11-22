import { describe, expect, test } from 'bun:test';
import {
	LAST_LOGIN_COOKIE,
	LAST_LOGIN_METHODS,
	cookieValue,
	parseLastLoginMethod,
} from '../../src/lib/last-login';

/**
 * ERP-0112: the badge value comes from a client-writable cookie, so only the
 * known methods may pass. The helpers are pure DOM-string reads — deliberately
 * no Better Auth client import, which a mocked `@/lib/auth-client` would break
 * in CI.
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

describe('cookieValue', () => {
	test('finds the cookie among others, whatever the spacing', () => {
		const jar = `a=1; ${LAST_LOGIN_COOKIE}=google; theme=dark`;
		expect(cookieValue(jar, LAST_LOGIN_COOKIE)).toBe('google');
		expect(cookieValue(` ${LAST_LOGIN_COOKIE}=email `, LAST_LOGIN_COOKIE)).toBe('email');
	});

	test('returns null when absent and decodes encoded values', () => {
		expect(cookieValue('a=1', LAST_LOGIN_COOKIE)).toBeNull();
		expect(cookieValue('', LAST_LOGIN_COOKIE)).toBeNull();
		expect(cookieValue('x=a%20b', 'x')).toBe('a b');
	});

	test('does not match a name that is a prefix of another', () => {
		expect(cookieValue('x_extra=1', 'x')).toBeNull();
	});
});
