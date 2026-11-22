/**
 * Cash in/out aggregate for the M01 dashboard
 * (`GET /finance/cash-bank-transactions/summary`, ERP-0111).
 *
 * Pinned without a database (bun-test skill rule 1.1):
 * - {@link fillCashFlowSummary}: zero-filling, totals and `net`;
 * - `CashBankRepository.summarizeTransactions` over a mocked Drizzle chain:
 *   tenant scope, the `transaction_date` window, the `posted` filter, the
 *   opening-balance exclusion and numeric coercion of the aggregates.
 */
import { describe, expect, test } from 'bun:test';
import { CashBankRepository } from '../../src/app/finance/repositories/cash-bank.repository';
import { fillCashFlowSummary } from '../../src/app/finance/utils/cash-flow-summary';
import { mockDb } from '../helpers/mock-db';

const ORG = '0190a1b2-0000-7000-8000-0000000000bb';

/** Flattens a cyclic Drizzle SQL tree into the literal strings it carries. */
function sqlLiterals(node: unknown, seen = new Set<unknown>()): string[] {
	if (node === null || node === undefined) return [];
	if (typeof node === 'string' || typeof node === 'number') return [String(node)];
	if (typeof node === 'bigint') return [node.toString()];
	if (typeof node !== 'object' || seen.has(node)) return [];
	seen.add(node);
	const record = node as Record<string, unknown>;
	if (Array.isArray(record.queryChunks)) {
		return record.queryChunks.flatMap((chunk) => sqlLiterals(chunk, seen));
	}
	if (Array.isArray(node)) {
		return (node as unknown[]).flatMap((chunk) => sqlLiterals(chunk, seen));
	}
	return ['value', 'queryChunks', 'name', 'columnType'].flatMap((key) =>
		sqlLiterals(record[key], seen),
	);
}

describe('fillCashFlowSummary (pure)', () => {
	test('zero-fills missing periods and computes in, out and net', () => {
		const summary = fillCashFlowSummary(
			{ from: '2026-09-01', to: '2026-11-30', groupBy: 'month' },
			[
				{ period: '2026-09', totalIn: 1_000_000, totalOut: 250_000 },
				{ period: '2026-11', totalIn: 0, totalOut: 900_000 },
			],
		);
		expect(summary.buckets).toEqual([
			{ period: '2026-09', totalIn: 1_000_000, totalOut: 250_000 },
			{ period: '2026-10', totalIn: 0, totalOut: 0 },
			{ period: '2026-11', totalIn: 0, totalOut: 900_000 },
		]);
		expect(summary.totalIn).toBe(1_000_000);
		expect(summary.totalOut).toBe(1_150_000);
		expect(summary.net).toBe(-150_000);
	});

	test('a window with no movement is all zeros, never empty', () => {
		const summary = fillCashFlowSummary(
			{ from: '2026-11-01', to: '2026-11-03', groupBy: 'day' },
			[],
		);
		expect(summary.buckets.map((bucket) => bucket.period)).toEqual([
			'2026-11-01',
			'2026-11-02',
			'2026-11-03',
		]);
		expect(summary.net).toBe(0);
	});
});

describe('CashBankRepository.summarizeTransactions', () => {
	test('coerces string aggregates from bun-sql', async () => {
		const { db } = mockDb({
			rows: [{ period: '2026-11', totalIn: '1500000', totalOut: 20_000 }],
		});
		const repository = new CashBankRepository(db as never);
		const rows = await repository.summarizeTransactions(ORG, {
			from: '2026-11-01',
			to: '2026-11-30',
			groupBy: 'month',
		});
		expect(rows).toEqual([{ period: '2026-11', totalIn: 1_500_000, totalOut: 20_000 }]);
	});

	test('scopes by organization and window, counts posted only, excludes opening balances', async () => {
		const { db, captured } = mockDb({ rows: [] });
		const repository = new CashBankRepository(db as never);
		await repository.summarizeTransactions(ORG, {
			from: '2026-11-01',
			to: '2026-11-30',
			groupBy: 'day',
		});
		const where = captured.find((call) => call.method === 'where');
		expect(where).toBeDefined();
		const rendered = sqlLiterals(where?.args).join(' ');
		expect(rendered).toContain(ORG);
		expect(rendered).toContain('2026-11-01');
		expect(rendered).toContain('2026-11-30');
		expect(rendered).toContain('posted');
		expect(rendered).toContain('opening_balance');
		expect(captured.some((call) => call.method === 'groupBy')).toBe(true);
	});
});
