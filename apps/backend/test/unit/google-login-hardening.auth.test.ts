import { describe, expect, test } from 'bun:test';
import { APIError } from 'better-auth/api';
import { socialAccountLinkGuard } from '../../src/providers/better-auth/options/account-link.auth';
import { buildSocialProviders } from '../../src/providers/better-auth/options/social-providers.auth';

/**
 * ERP-0107 hardening of Google sign-in: invitation-only, active accounts only.
 * No module mocks; the account owner lookup is injected.
 */

type TGuardArgs = Parameters<ReturnType<typeof socialAccountLinkGuard>>;

const account = (providerId: string) =>
	({ providerId, accountId: 'g-123', userId: 'u-1' }) as unknown as TGuardArgs[0];
const context = null as unknown as TGuardArgs[1];

const guardFor = (owner: { status: string | null; deletedAt: Date | null } | null) =>
	socialAccountLinkGuard(async () => owner);

async function refusal(promise: Promise<unknown>) {
	try {
		await promise;
		return null;
	} catch (error) {
		return error;
	}
}

describe('buildSocialProviders', () => {
	test('Google can never sign up a new user (invitation-only)', () => {
		const providers = buildSocialProviders({ clientId: 'id', clientSecret: 'secret' });
		// Built as a plain object (the option type also allows a factory).
		const google = providers.google as { disableSignUp?: boolean } | undefined;
		expect(google?.disableSignUp).toBe(true);
	});

	test('Google stays off without credentials', () => {
		expect(buildSocialProviders(null).google).toBeUndefined();
		expect(buildSocialProviders({ clientId: 'id', clientSecret: null }).google).toBeUndefined();
	});
});

describe('socialAccountLinkGuard', () => {
	test('links Google to an active account', async () => {
		await expect(
			guardFor({ status: 'active', deletedAt: null })(account('google'), context),
		).resolves.toBeUndefined();
	});

	test.each([
		['a pending invitation', { status: 'pending', deletedAt: null }],
		['a deactivated account', { status: 'deactivated', deletedAt: null }],
		['a soft-deleted account', { status: 'active', deletedAt: new Date() }],
		['a missing owner', null],
	])('refuses Google for %s with ACCOUNT_NOT_ACTIVE', async (_label, owner) => {
		const error = await refusal(guardFor(owner)(account('google'), context));
		expect(error).toBeInstanceOf(APIError);
		expect((error as APIError).body?.code).toBe('ACCOUNT_NOT_ACTIVE');
	});

	test('the claim may still write the password of a pending invitation', async () => {
		await expect(
			guardFor({ status: 'pending', deletedAt: null })(account('credential'), context),
		).resolves.toBeUndefined();
	});
});
