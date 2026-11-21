import type { BetterAuthOptions } from 'better-auth';
import { userCacheKey, userListCacheKey } from '../../../app/user/constants/cache';

type UserUpdateAfter = NonNullable<
	NonNullable<
		NonNullable<NonNullable<BetterAuthOptions['databaseHooks']>['user']>['update']
	>['after']
>;

/**
 * Evicts the cached `auth.users` row after every Better Auth user update
 * (ERP-0107).
 *
 * @remarks
 * `UserRepository.findById` serves `GET /users/me` from a Redis cache-aside
 * entry (`USER_CACHE_TTL_SECONDS`), but Better Auth writes the row itself:
 * `/update-user` (self profile and username), the admin API, email
 * verification and change-email. None of those passed through the
 * repository, so the profile kept showing the old bio, username, email or
 * verification badge for up to five minutes. One hook covers every Better
 * Auth write path. Eviction failures are logged and swallowed: a cache
 * outage must never fail the write that already happened.
 *
 * @param del - Deletes Redis keys (the shared client in production, a fake
 * in tests)
 */
export function userCacheEvictHook(
	del: (...keys: string[]) => Promise<unknown>,
): UserUpdateAfter {
	return async (user) => {
		try {
			await del(userCacheKey(user.id), userListCacheKey());
		} catch (error) {
			console.error('[user-cache] eviction failed for user', user.id, error);
		}
	};
}
