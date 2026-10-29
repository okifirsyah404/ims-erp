import type { BetterAuthOptions } from 'better-auth';
import { redisClient } from '@providers/redis/redis';
import { betterAuthLogger } from '../logger.auth';

/**
 * Better Auth secondary storage backed by the shared Bun RedisClient.
 *
 * Contract notes:
 * - Better Auth stores JSON-serialized strings; no extra (de)serialization here.
 * - `set`'s `ttl` is in SECONDS (Better Auth contract); Bun's `setex` also
 *   takes seconds, so the value passes through unchanged.
 * - Keys are prefixed with `better-auth:` so auth data is identifiable and
 *   flushable independently of the application cache.
 * - Fail closed: Redis errors are logged and re-thrown so a storage outage is
 *   never silently treated as "no session".
 */
const KEY_PREFIX = 'better-auth:';

export const betterAuthSecondaryStorage: BetterAuthOptions['secondaryStorage'] = {
	get: async (key) => {
		try {
			return await redisClient.get(KEY_PREFIX + key);
		} catch (error) {
			betterAuthLogger.error('secondaryStorage.get failed', { key, error });
			throw error;
		}
	},
	getAndDelete: async (key) => {
		try {
			// Atomic GETDEL (Redis >= 6.2); null when the key does not exist.
			return await redisClient.getdel(KEY_PREFIX + key);
		} catch (error) {
			betterAuthLogger.error('secondaryStorage.getAndDelete failed', {
				key,
				error,
			});
			throw error;
		}
	},
	increment: async (key, ttl) => {
		try {
			// Atomic INCR; TTL applies only on first creation so the counter
			// window is fixed from creation (Better Auth rate-limit contract).
			const count = await redisClient.incr(KEY_PREFIX + key);
			if (count === 1) {
				await redisClient.expire(KEY_PREFIX + key, ttl);
			}
			return count;
		} catch (error) {
			betterAuthLogger.error('secondaryStorage.increment failed', {
				key,
				error,
			});
			throw error;
		}
	},
	set: async (key, value, ttl) => {
		try {
			if (ttl === undefined || ttl === 0) {
				// No expiry requested (or explicit no-expiry).
				await redisClient.set(KEY_PREFIX + key, value);
				return;
			}
			await redisClient.setex(KEY_PREFIX + key, ttl, value);
		} catch (error) {
			betterAuthLogger.error('secondaryStorage.set failed', { key, error });
			throw error;
		}
	},
	delete: async (key) => {
		try {
			await redisClient.del(KEY_PREFIX + key);
		} catch (error) {
			betterAuthLogger.error('secondaryStorage.delete failed', { key, error });
			throw error;
		}
	},
};
