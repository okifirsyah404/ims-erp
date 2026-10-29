import { appConfig } from '@config/providers/config';
import { RedisClient } from 'bun';

export const redisClient = new RedisClient(appConfig.redis.url!);

process.on('SIGTERM', () => {
	redisClient.close();
});
