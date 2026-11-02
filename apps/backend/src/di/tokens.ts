/**
 * DI tokens only - no provider values, no database/client imports.
 *
 * @remarks
 * Kept separate from `provider.ts` so modules that only need a token (e.g.
 * the authorization resolver, repositories) do not pull the Drizzle/Redis
 * clients into their import chain.
 *
 * This file is the **single definition site** for every global token.
 * `provider.ts` imports these and re-exports them so both `@di/tokens` and
 * `@di/provider` resolve the identical `Symbol` - the re-export is a pure
 * alias, never a second `Symbol(...)` call.
 */

/** Resolves to the shared Drizzle (`bun-sql`) database handle. */
export const DRIZZLE_TOKEN = Symbol('DRIZZLE_TOKEN');

/** Resolves to the shared Bun `RedisClient`. */
export const REDIS_TOKEN = Symbol('REDIS_TOKEN');
