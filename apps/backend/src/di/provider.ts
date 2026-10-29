import { drizzleDB } from '@drizzle/db';
import { redisClient } from '@providers/redis/redis';
import { RedisClient } from 'bun';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DependencyContainer } from 'tsyringe';

export const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');
export const REDIS_TOKEN = Symbol('REDIS_TOKEN');

export function registerProvider(container: DependencyContainer) {
	container.register<BunSQLDatabase>(DRIZZLE_TOKEN, {
		useValue: drizzleDB,
	});
	container.register<RedisClient>(REDIS_TOKEN, {
		useValue: redisClient,
	});
}
