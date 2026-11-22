import { describe, expect, test } from 'bun:test';
import { resolveLoginMethodOverride } from '../../src/providers/better-auth/plugins/last-login-method.auth';

/**
 * ERP-0112: only `/sign-in/username` is added to the library's mapping.
 * Everything else returns `null` so Better Auth's default resolver runs.
 */
describe('resolveLoginMethodOverride', () => {
	test('username sign-in is recognised', () => {
		expect(resolveLoginMethodOverride('/sign-in/username')).toBe('username');
	});

	test('other methods fall back to the library mapping', () => {
		expect(resolveLoginMethodOverride('/sign-in/email')).toBeNull();
		expect(resolveLoginMethodOverride('/callback/google')).toBeNull();
		expect(resolveLoginMethodOverride('/passkey/verify-authentication')).toBeNull();
		expect(resolveLoginMethodOverride(undefined)).toBeNull();
	});
});
