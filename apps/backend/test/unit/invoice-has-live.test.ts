/**
 * `InvoiceRepository.hasLiveInvoices` decides whether a sales order can still be
 * cancelled. A void or cancelled invoice must not lock the order; a draft or an
 * issued invoice must.
 *
 * Pinned over a mocked Drizzle chain (bun-test skill rule 1.1). The status
 * literals are read from the captured `where` clause, so a change to the
 * exclusion list fails here, not in production.
 */
import { describe, expect, test } from 'bun:test';
import { InvoiceRepository } from '../../src/app/sales/repositories/invoice.repository';
import { mockDb } from '../helpers/mock-db';

const ORDER = '0190a1b2-0000-7000-8000-0000000000bb';

/** Every string literal bound in a Drizzle SQL/condition tree. */
function literals(node: unknown, seen = new Set<unknown>()): string[] {
	if (node === null || node === undefined) return [];
	if (typeof node === 'string' || typeof node === 'number') return [String(node)];
	if (typeof node !== 'object' || seen.has(node)) return [];
	seen.add(node);
	const record = node as Record<string, unknown>;
	if (Array.isArray(record.queryChunks)) {
		return (record.queryChunks as unknown[]).flatMap((chunk) => literals(chunk, seen));
	}
	if (Array.isArray(node)) return (node as unknown[]).flatMap((chunk) => literals(chunk, seen));
	return ['value', 'queryChunks'].flatMap((key) => literals(record[key], seen));
}

describe('InvoiceRepository.hasLiveInvoices', () => {
	test('excludes void and cancelled invoices from the lock', async () => {
		const { db, captured } = mockDb({ rows: [] });
		const repository = new InvoiceRepository(db as never);

		const result = await repository.hasLiveInvoices(ORDER);

		expect(result).toBe(false);
		const where = captured.find((call) => call.method === 'where');
		expect(where).toBeDefined();
		const bound = literals(where!.args);
		expect(bound).toContain('void');
		expect(bound).toContain('cancelled');
		expect(bound).toContain(ORDER);
	});

	test('an order with a live invoice is reported as locked', async () => {
		const { db } = mockDb({ rows: [{ id: 'inv-1' }] });
		const repository = new InvoiceRepository(db as never);

		expect(await repository.hasLiveInvoices(ORDER)).toBe(true);
	});
});
