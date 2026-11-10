/**
 * Cache key builders for the Redis-backed repository caches.
 *
 * @remarks
 * Pure string helpers only — the cache mechanics (JSON encoding, TTL,
 * negative caching) live in {@link import('@cache/cache.client').CacheClient},
 * which repositories receive via `CACHE_CLIENT_TOKEN`. Only repositories
 * may cache (layered-architecture rule 1.3): caches live behind repository
 * interfaces, never in services or controllers.
 */

/** Cache-aside TTL applied to cached reads (5 minutes). */
export const CACHE_TTL_SECONDS = 300;

/** Cache key for a whole collection (e.g. `location:province:all`). */
export function cacheListKey(prefix: string): string {
	return `${prefix}:all`;
}

/** Cache key for a single row by id (e.g. `location:province:id:42`). */
export function cacheIdKey(prefix: string, id: string | number): string {
	return `${prefix}:id:${id}`;
}

/** Cache key for rows scoped to an organization (e.g. `assets:asset-category:org:7`). */
export function cacheOrgKey(prefix: string, organizationId: string | number): string {
	return `${prefix}:org:${organizationId}`;
}
