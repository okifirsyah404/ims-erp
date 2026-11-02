import { drizzleDB } from '@drizzle/db';
import { redisClient } from '@providers/redis/redis';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DependencyContainer } from 'tsyringe';
import { DRIZZLE_TOKEN, REDIS_TOKEN } from './tokens';

/**
 * Re-exported aliases, not redefinitions: `tokens.ts` is the single
 * definition site, so `@di/provider` and `@di/tokens` hand out the same
 * `Symbol`. Modules that only need a token should prefer `@di/tokens` so
 * they stay clear of the client imports in this file.
 */
export { DRIZZLE_TOKEN, REDIS_TOKEN };

export function registerProvider(container: DependencyContainer) {
	container.register<BunSQLDatabase>(DRIZZLE_TOKEN, {
		useValue: drizzleDB,
	});
	container.register<RedisClient>(REDIS_TOKEN, {
		useValue: redisClient,
	});
}
