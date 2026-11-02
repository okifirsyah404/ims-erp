import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';

/**
 * A Drizzle handle that may be a live transaction.
 *
 * @remarks
 * `architecture.md` §"Transactions ownership decision" makes services the owner
 * of transaction boundaries: a service acquires a transaction handle and passes
 * the **transaction-scoped** handle down to each repository it calls, so a
 * multi-statement operation commits or rolls back as one unit.
 *
 * Drizzle's transaction callback receives the same query-builder surface as the
 * client, so repositories type their optional handle as {@link TTx} and work
 * unchanged inside and outside a transaction.
 */
export type TDb = BunSQLDatabase;

/**
 * The handle passed into a transaction callback.
 *
 * @remarks
 * Structurally a {@link TDb}, but named separately so a repository method that
 * may join a caller's transaction is visibly distinct from one that always opens
 * its own.
 */
export type TTx = Parameters<Parameters<TDb['transaction']>[0]>[0];
