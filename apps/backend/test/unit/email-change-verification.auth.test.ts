import { describe, expect, test } from 'bun:test';
import { betterAuthChangeEmailOptions } from '../../src/providers/better-auth/options/change-email.auth';
import {
	EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
	emailVerificationPolicy,
} from '../../src/providers/better-auth/options/email-verification-policy.auth';
import { userCacheEvictHook } from '../../src/providers/better-auth/options/user-cache.auth';

/**
 * Unit tests for the Better Auth change-email and email-verification policy
 * (ERP-0111). Both modules are side-effect free, so no module mocks are
 * needed (Bun's `mock.module` would leak into `mailer.test.ts`).
 */

describe('change-email options', () => {
	test('change email is enabled (Better Auth rejects every call otherwise)', () => {
		expect(betterAuthChangeEmailOptions.enabled).toBe(true);
	});

	test('never updates the email without verifying the new address', () => {
		expect(betterAuthChangeEmailOptions.updateEmailWithoutVerification).toBeUndefined();
	});

	test('no confirmation step on the old address (owner decision)', () => {
		expect(betterAuthChangeEmailOptions.sendChangeEmailConfirmation).toBeUndefined();
	});
});

describe('user cache eviction on Better Auth updates', () => {
	type THookArgs = Parameters<ReturnType<typeof userCacheEvictHook>>;
	const user = { id: 'u-1' } as THookArgs[0];
	const context = null as unknown as THookArgs[1];

	test('evicts the row and the list entry that serve GET /users/me', async () => {
		const deleted: string[][] = [];
		await userCacheEvictHook(async (...keys) => {
			deleted.push(keys);
		})(user, context);
		expect(deleted).toEqual([['user:id:u-1', 'user:all']]);
	});

	test('a cache outage never fails the update that already happened', async () => {
		const original = console.error;
		console.error = () => {};
		try {
			await expect(
				userCacheEvictHook(async () => {
					throw new Error('redis down');
				})(user, context),
			).resolves.toBeUndefined();
		} finally {
			console.error = original;
		}
	});
});

describe('email-verification policy', () => {
	test('links expire after one hour, in seconds', () => {
		expect(EMAIL_VERIFICATION_EXPIRES_IN_SECONDS).toBe(3600);
		expect(emailVerificationPolicy.expiresIn).toBe(3600);
	});

	test('opening a link never signs the browser in', () => {
		expect(emailVerificationPolicy.autoSignInAfterVerification).toBe(false);
	});
});
