import { describe, expect, test } from 'bun:test';
import {
	loginErrorCallbackUrl,
	loginErrorKey,
	sameOriginUrl,
} from '../../src/lib/login-error';

const ORIGIN = 'http://localhost:5173';

describe('loginErrorKey', () => {
	test('maps every refusal of a Google sign-in', () => {
		expect(loginErrorKey('signup_disabled')).toBe('login.googleNotRegistered');
		expect(loginErrorKey('ACCOUNT_NOT_ACTIVE')).toBe('login.accountNotActive');
		expect(loginErrorKey('WEB_ADMIN_ACCESS_DENIED')).toBe('login.noAccess');
		expect(loginErrorKey('account_not_linked')).toBe('login.googleNotLinked');
		expect(loginErrorKey('BANNED_USER')).toBe('login.banned');
	});

	test('unknown codes get the generic line; no code, no message', () => {
		expect(loginErrorKey('state_mismatch')).toBe('login.googleFailed');
		expect(loginErrorKey(undefined)).toBeNull();
		expect(loginErrorKey('')).toBeNull();
	});
});

describe('sameOriginUrl', () => {
	test('turns the guard path into an absolute app URL', () => {
		expect(sameOriginUrl('/sales?page=2', ORIGIN)).toBe(`${ORIGIN}/sales?page=2`);
		expect(sameOriginUrl(undefined, ORIGIN)).toBe(`${ORIGIN}/`);
	});

	test('never redirects to another origin', () => {
		expect(sameOriginUrl('https://evil.example/steal', ORIGIN)).toBe(`${ORIGIN}/`);
		expect(sameOriginUrl('//evil.example/steal', ORIGIN)).toBe(`${ORIGIN}/`);
	});
});

describe('loginErrorCallbackUrl', () => {
	test('returns to /login and keeps the requested path', () => {
		expect(loginErrorCallbackUrl(ORIGIN, undefined)).toBe(`${ORIGIN}/login`);
		expect(loginErrorCallbackUrl(ORIGIN, '/sales')).toBe(`${ORIGIN}/login?redirect=%2Fsales`);
	});
});
