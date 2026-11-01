import { drizzleDB } from '@drizzle/db';
import { redisClient } from '@providers/redis/redis';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DependencyContainer } from 'tsyringe';
import { DRIZZLE_TOKEN, REDIS_TOKEN } from './tokens';

export { DRIZZLE_TOKEN, REDIS_TOKEN };

export function registerProvider(container: DependencyContainer) {
	container.register<BunSQLDatabase>(DRIZZLE_TOKEN, {
		useValue: drizzleDB,
	});
	container.register<RedisClient>(REDIS_TOKEN, {
		useValue: redisClient,
	});
}
