import { REDIS_TOKEN } from '@di/tokens';
import { CACHE_TTL_SECONDS } from '@utils/cache.util';
import type { RedisClient } from 'bun';
import { inject, injectable } from 'tsyringe';

/**
 * Cache-aside contract for repository read caches.
 *
 * @remarks
 * Repositories depend on this interface — never on Bun's `RedisClient` —
 * so the cache mechanics (JSON encoding, TTL, negative caching, corrupt
 * entry recovery) live in exactly one place. Keys are plain colon-joined
 * strings built with the helpers in `@utils/cache.util`.
 */
export interface ICacheClient {
	/**
	 * Reads a cached JSON value.
	 *
	 * @returns The parsed value; `undefined` on cache miss, `null` when a
	 * null result was negatively cached
	 */
	get<T>(key: string): Promise<T | undefined>;

	/**
	 * Writes a JSON value with the shared TTL. Storing `null` (or an
	 * `undefined` loader result) is the negative-caching convention.
	 */
	set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

	/** Evicts one or more cache keys in a single round trip. */
	del(...keys: string[]): Promise<void>;

	/**
	 * Cache-aside read: returns the cached value, or runs `loader` on a
	 * miss, stores its result (including `null`/`undefined` as negative
	 * caching), and returns it.
	 */
	remember<T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<T>;
}

/**
 * Redis-backed {@link ICacheClient} over Bun's native `RedisClient`.
 *
 * @remarks
 * Corrupt (non-JSON) entries are treated as a miss and evicted instead of
 * throwing, so a bad payload can never poison a hot path.
 */
@injectable()
export class CacheClient implements ICacheClient {
	constructor(@inject(REDIS_TOKEN) private readonly redisClient: RedisClient) {}

	async get<T>(key: string): Promise<T | undefined> {
		const cached = await this.redisClient.get(key);
		if (cached === null) return undefined;
		try {
			return JSON.parse(cached) as T;
		} catch {
			await this.redisClient.del(key);
			return undefined;
		}
	}

	async set<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
		await this.redisClient.set(key, JSON.stringify(value ?? null), 'EX', ttlSeconds);
	}

	async del(...keys: string[]): Promise<void> {
		if (keys.length === 0) return;
		await this.redisClient.del(...keys);
	}

	async remember<T>(
		key: string,
		loader: () => Promise<T>,
		ttlSeconds: number = CACHE_TTL_SECONDS,
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== undefined) return cached;

		const fresh = await loader();
		await this.set(key, fresh ?? null, ttlSeconds);
		return fresh;
	}
}
