/**
 * Shared Redis cache keys for `auth.users` reads.
 *
 * @remarks
 * Two repositories write/read the same table: the user module's
 * `UserRepository` (self-service reads, cached) and the user-management
 * module's `UserManagementRepository` (admin lifecycle writes). They must
 * agree on the key layout, otherwise a write through one does not evict the
 * other's cached read and the API serves a stale row for the whole TTL.
 *
 * Lives in its own module (no imports) so either side can use it without
 * reaching into the other's internals.
 */

/** Prefix for every `auth.users` cache entry. */
export const USER_CACHE_PREFIX = 'user';

/** TTL for cached `auth.users` rows. */
export const USER_CACHE_TTL_SECONDS = 300;

/** Cache key for the whole user list. */
export function userListCacheKey(): string {
	return `${USER_CACHE_PREFIX}:all`;
}

/** Cache key for a single user row. */
export function userCacheKey(id: string): string {
	return `${USER_CACHE_PREFIX}:id:${id}`;
}
