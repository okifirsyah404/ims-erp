/**
 * Cross-module unit of work (ADR-0011 §5; the old branch's ADR-0009 rule).
 *
 * @remarks
 * Services never inject `DRIZZLE_TOKEN`. When one use case must commit rows
 * of several modules together — a goods receipt, its purchase-order
 * progress, the stock movements and the serial units — the service asks this
 * runner for a transaction and hands the handle to each module's contract
 * method (`postMovement(input, tx)`, repository `…(…, tx)`). A failure in any
 * step rolls back all of them.
 */
import type { TTx } from '@drizzle/types';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import type { InjectionToken } from 'tsyringe';

export interface ITransactionRunner {
	run<T>(work: (tx: TTx) => Promise<T>): Promise<T>;
}

export const TRANSACTION_RUNNER_TOKEN: InjectionToken<ITransactionRunner> = Symbol('TRANSACTION_RUNNER');

export function drizzleTransactionRunner(database: BunSQLDatabase): ITransactionRunner {
	return { run: (work) => database.transaction(work) };
}
