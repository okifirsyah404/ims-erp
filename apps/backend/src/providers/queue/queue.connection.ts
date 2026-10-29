import { createBunRedisClient } from 'bullmq';
import { redisClient } from '@providers/redis/redis';

/**
 * Shared BullMQ connection over the existing Bun Redis client (no ioredis).
 * Queue and Worker instances reuse this adapter; BullMQ duplicates the raw
 * client internally wherever a blocking connection is required.
 *
 * Shutdown must go through the wrapper (`quit`/`disconnect`), never
 * `redisClient.close()` directly, so in-flight commands drain cleanly.
 */
export const queueConnection = createBunRedisClient(redisClient);

export async function closeQueueConnection(): Promise<void> {
	await queueConnection.quit();
}
