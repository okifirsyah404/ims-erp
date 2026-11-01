/**
 * DI tokens only - no provider values, no database/client imports.
 *
 * Kept separate from `provider.ts` so modules that only need the token (e.g.
 * the authorization resolver) do not pull the Drizzle/Redis clients into
 * their import chain.
 */
export const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');
export const REDIS_TOKEN = Symbol('REDIS_TOKEN');
