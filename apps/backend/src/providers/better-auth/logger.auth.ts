import { pinoLogger } from '@providers/logger/logger';

export const betterAuthLogger = {
	log: (message: string, ...args: unknown[]) => pinoLogger.info({ ctx: 'BetterAuth' }, message, ...args),
	warn: (message: string, ...args: unknown[]) => pinoLogger.warn({ ctx: 'BetterAuth' }, message, ...args),
	error: (message: string, ...args: unknown[]) => pinoLogger.error({ ctx: 'BetterAuth' }, message, ...args),
};
