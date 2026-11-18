/**
 * Invoiced-sales aggregate for the M01 dashboard (`GET /invoices/summary`).
 *
 * Two layers are pinned here, both without a database (bun-test skill rule
 * 1.1):
 * - the pure window helpers ({@link periodKeys}, {@link fillSummary}), which
 *   decide zero-filling and the Jakarta month boundaries;
 * - `InvoiceRepository.summary`, over a mocked Drizzle chain: the tenant scope,
 *   the `issue_date` range, the status filter that keeps draft/void/cancelled
 *   out of "invoiced", and the numeric coercion of the SQL aggregates.
 *
 * The SQL itself was executed once against the local PostgreSQL while building
 * this endpoint; the evidence is recorded in `progress.md` 2026-11-15.
 */
import { describe, expect, test } from 'bun:test';
import { InvoiceRepository } from '../../src/app/sales/repositories/invoice.repository';
import { fillSummary, periodKeys } from '../../src/app/sales/utils/invoice-summary';
import { mockDb } from '../helpers/mock-db';

const ORG = '0190a1b2-0000-7000-8000-0000000000aa';

/**
 * Flattens a Drizzle SQL tree into the literal strings it binds.
 *
 * @remarks
 * The tree is cyclic (column chunks point back at their table), so this walks
 * `queryChunks` / `value` explicitly instead of serializing it.
 */
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

describe('invoice summary windows (pure)', () => {
	test('month keys cover every month the window touches', () => {
		expect(periodKeys('2026-06-15', '2026-11-02', 'month')).toEqual([
			'2026-06',
			'2026-07',
			'2026-08',
			'2026-09',
			'2026-10',
			'2026-11',
		]);
	});

	test('month keys cross the year boundary', () => {
		expect(periodKeys('2025-11-01', '2026-02-01', 'month')).toEqual([
			'2025-11',
			'2025-12',
			'2026-01',
			'2026-02',
		]);
	});

	test('day keys are inclusive on both ends', () => {
		expect(periodKeys('2026-11-01', '2026-11-03', 'day')).toEqual([
			'2026-11-01',
			'2026-11-02',
			'2026-11-03',
		]);
	});

	test('fillSummary zero-fills missing periods and sums the buckets', () => {
		const summary = fillSummary({ from: '2026-09-01', to: '2026-11-30', groupBy: 'month' }, [
			{ period: '2026-09', invoiced: 1_000_000, count: 2 },
			{ period: '2026-11', invoiced: 500_000, count: 1 },
		]);
		expect(summary.buckets).toEqual([
			{ period: '2026-09', invoiced: 1_000_000, count: 2 },
			{ period: '2026-10', invoiced: 0, count: 0 },
			{ period: '2026-11', invoiced: 500_000, count: 1 },
		]);
		expect(summary.totalInvoiced).toBe(1_500_000);
		expect(summary.invoiceCount).toBe(3);
	});

	test('a window with no invoices is all zeros, never empty', () => {
		const summary = fillSummary({ from: '2026-01-01', to: '2026-02-28', groupBy: 'month' }, []);
		expect(summary.buckets.map((bucket) => bucket.period)).toEqual(['2026-01', '2026-02']);
		expect(summary.totalInvoiced).toBe(0);
		expect(summary.invoiceCount).toBe(0);
	});
});

describe('InvoiceRepository.summary', () => {
	test('coerces the SQL aggregates and zero-fills the window', async () => {
		// bun-sql may hand `sum(...)::bigint` and `count(*)` back as strings.
		const { db } = mockDb({
			rows: [
				{ period: '2026-09', invoiced: '500000', count: '2' },
				{ period: '2026-11', invoiced: 500_000, count: 1 },
			],
		});
		const repository = new InvoiceRepository(db as never);

		const summary = await repository.summary(ORG, {
			from: '2026-09-01',
			to: '2026-11-30',
			groupBy: 'month',
		});

		expect(summary.buckets).toEqual([
			{ period: '2026-09', invoiced: 500_000, count: 2 },
			{ period: '2026-10', invoiced: 0, count: 0 },
			{ period: '2026-11', invoiced: 500_000, count: 1 },
		]);
		expect(summary.totalInvoiced).toBe(1_000_000);
		expect(summary.invoiceCount).toBe(3);
		expect(summary.groupBy).toBe('month');
	});

	test('scopes by organization, bounds the window and filters statuses in SQL', async () => {
		const { db, captured } = mockDb({ rows: [] });
		const repository = new InvoiceRepository(db as never);

		await repository.summary(ORG, { from: '2026-09-01', to: '2026-11-30', groupBy: 'month' });

		const where = captured.find((call) => call.method === 'where');
		expect(where).toBeDefined();
		// The where() argument is a Drizzle SQL tree; its chunks carry the
		// bindings. Assert the tenant id and the date bounds reached the query.
		const rendered = sqlLiterals(where?.args).join(' ');
		expect(rendered).toContain(ORG);
		expect(rendered).toContain('2026-09-01');
		expect(rendered).toContain('2026-11-30');
		// Every invoiced status is in the `in` list; the excluded ones are not.
		// (`overdue` is derived at read time, never stored, so it is not listed.)
		for (const status of ['issued', 'partially_paid', 'paid']) {
			expect(rendered).toContain(status);
		}
		expect(rendered).not.toContain('draft');
		expect(rendered).not.toContain('void');
		expect(rendered).not.toContain('cancelled');
		expect(captured.some((call) => call.method === 'groupBy')).toBe(true);
	});
});
