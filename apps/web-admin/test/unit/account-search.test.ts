import { describe, expect, test } from 'bun:test';
import {
	USERNAME_PATTERN,
	accountsCallbackUrl,
	accountsSearchSchema,
	linkOutcome,
	verificationOutcome,
} from '../../src/lib/account-search';

const parse = (input: Record<string, unknown>) => accountsSearchSchema.parse(input);

describe('accountsSearchSchema', () => {
	test('accepts the number TanStack produces for ?verified=1', () => {
		expect(parse({ section: 'email', verified: 1 }).verified).toBe(1);
		expect(parse({ section: 'email', verified: '1' }).verified).toBe('1');
	});

	test('drops unknown sections and junk flags instead of throwing', () => {
		expect(parse({ section: 'nope', verified: 'yes' })).toEqual({
			section: undefined,
			verified: undefined,
			linked: undefined,
			error: undefined,
		});
	});
});

describe('accountsCallbackUrl', () => {
	test('is absolute, hash-free, and carries the section', () => {
		expect(accountsCallbackUrl('http://localhost:5173', 'email', { verified: '1' })).toBe(
			'http://localhost:5173/accounts?section=email&verified=1',
		);
	});
});

describe('verificationOutcome', () => {
	test('verified only for the email section without an error', () => {
		expect(verificationOutcome(parse({ section: 'email', verified: 1 }))).toBe('verified');
		expect(verificationOutcome(parse({ verified: 1 }))).toBeNull();
	});

	test('Better Auth appends the error to the success URL: the error wins', () => {
		expect(
			verificationOutcome(parse({ section: 'email', verified: 1, error: 'TOKEN_EXPIRED' })),
		).toBe('expired');
		expect(
			verificationOutcome(parse({ section: 'email', verified: 1, error: 'INVALID_TOKEN' })),
		).toBe('invalid');
		expect(
			verificationOutcome(parse({ section: 'email', error: 'USER_NOT_FOUND' })),
		).toBe('invalid');
	});

	test('nothing to report on a plain visit', () => {
		expect(verificationOutcome(parse({}))).toBeNull();
		expect(verificationOutcome(parse({ section: 'email' }))).toBeNull();
	});
});

describe('linkOutcome', () => {
	test('maps the OAuth callback error codes', () => {
		expect(linkOutcome(parse({ section: 'connected', linked: 1 }))).toBe('linked');
		expect(
			linkOutcome(parse({ section: 'connected', error: 'email_does_not_match' })),
		).toBe('emailMismatch');
		expect(
			linkOutcome(
				parse({ section: 'connected', error: 'account_already_linked_to_different_user' }),
			),
		).toBe('linkedElsewhere');
		expect(
			linkOutcome(parse({ section: 'connected', error: 'unable_to_link_account' })),
		).toBe('failed');
	});

	test('ignores other sections', () => {
		expect(linkOutcome(parse({ section: 'email', error: 'email_does_not_match' }))).toBeNull();
		expect(linkOutcome(parse({ section: 'connected' }))).toBeNull();
	});
});

describe('USERNAME_PATTERN', () => {
	test('mirrors the username plugin rule', () => {
		expect(USERNAME_PATTERN.test('oki_firdaus')).toBe(true);
		expect(USERNAME_PATTERN.test('ab')).toBe(false);
		expect(USERNAME_PATTERN.test('with-dash')).toBe(false);
		expect(USERNAME_PATTERN.test('a'.repeat(31))).toBe(false);
	});
});
