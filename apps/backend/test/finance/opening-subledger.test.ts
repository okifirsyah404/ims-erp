/**
 * Sub-ledger opening balances (ERP-0142): CSV import per ledger, the tie to
 * the control accounts, and the open items created when the batch posts.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { OpeningSubledgerService } from '../../src/app/finance/services/opening-subledger.service';
import {
	OpeningSubledgerDateError,
	OpeningSubledgerFileError,
	OpeningSubledgerMismatchError,
	OpeningSubledgerPostedError,
} from '../../src/app/finance/errors/ledger.errors';

const rp = (rupiah: number) => rupiah * 100;
const ctx = { organizationId: 'org-1', actorUserId: 'acc' };

function harness() {
	const items: Array<Record<string, any>> = [];
	const arItems: unknown[] = [];
	const apItems: unknown[] = [];
	const bills: Array<Record<string, unknown>> = [];
	const service = new OpeningSubledgerService(
		{
			list: async (_org: string, ledger?: string) => items.filter((item) => !item.deletedAt && (!ledger || item.ledger === ledger)) as never,
			replaceDrafts: async (_org: string, ledger: string, asOfDate: string, _by: string, rows: Array<Record<string, unknown>>) => {
				for (const item of items) if (item.ledger === ledger && !item.postedAt) item.deletedAt = 1;
				for (const row of rows) items.push({ ...row, id: crypto.randomUUID(), ledger, asOfDate, postedAt: null, deletedAt: null });
			},
			discardDrafts: async () => 0,
			markPosted: async (_org: string, id: string, links: Record<string, unknown>) => {
				Object.assign(items.find((item) => item.id === id)!, links, { postedAt: 1 });
			},
		},
		{ listOpeningBalances: async () => [] },
		{ resolveAccountId: async (_org: string, lookup: { role: string }) => (lookup.role === 'receivable' ? 'acc-ar' : 'acc-ap') },
		{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
		{ findCustomerByCode: async (code: string) => (code === 'CUS-1' ? ({ id: 'cus-1', name: 'PT Satu' } as never) : null) },
		{ findCompanyByCode: async (code: string) => (code === 'SUP-1' ? ({ id: 'sup-1', name: 'CV Pemasok' } as never) : null) },
		{
			insertArOpenItem: async (row: unknown) => {
				arItems.push(row);
				return { id: `ar-${arItems.length}` } as never;
			},
		},
		{
			insertApOpenItem: async (row: unknown) => {
				apItems.push(row);
				return { id: `ap-${apItems.length}` } as never;
			},
		},
		{
			insertSupplierBill: async (row: Record<string, unknown>) => {
				bills.push(row);
				return { id: `bill-${bills.length}` } as never;
			},
		},
		{ next: async () => 'BILL-0001' },
	);
	return { service, items, arItems, apItems, bills };
}
const csv = (text: string, name = 'opening.csv') => new File([text], name, { type: 'text/csv' });
const row = (accountId: string, debit: number, credit: number) =>
	({ accountId, debitBalance: debit, creditBalance: credit, asOfDate: '2026-10-31', postedAt: null }) as never;

describe('opening sub-ledger import', () => {
	test('valid AR rows replace the drafts; amounts accept Indonesian formats', async () => {
		const h = harness();
		const result = await h.service.import(
			ctx,
			'ar',
			'2026-10-31',
			csv('kode_pelanggan,nomor_dokumen,tanggal_dokumen,jatuh_tempo,sisa_rupiah\ncus-1,INV-OLD-1,2026-09-30,2026-10-30,"1.500.000"\nCUS-1,INV-OLD-2,2026-10-15,,"250000,50"\n'),
		);
		expect(result).toEqual({ imported: 2, total: rp(1_750_000) + 50, errors: [] });
		expect(h.items.map((item) => [item.customerId, item.partyName, item.amount, item.dueDate])).toEqual([
			['cus-1', 'PT Satu', rp(1_500_000), '2026-10-30'],
			['cus-1', 'PT Satu', rp(250_000) + 50, null],
		]);
	});

	test('a bad row rejects the whole file', async () => {
		const h = harness();
		const result = await h.service.import(
			ctx,
			'ap',
			'2026-10-31',
			csv('SUP-X,B-1,2026-09-30,,100\nSUP-1,B-2,2026-11-05,,100\nSUP-1,B-2,2026-09-01,13-01,0\n'),
		);
		expect(result.imported).toBe(0);
		expect(result.errors.map((error) => error.code).sort()).toEqual(['afterAsOf', 'amountInvalid', 'dueDateInvalid', 'duplicate', 'partyUnknown'].sort());
		expect(h.items).toEqual([]);
	});

	test('non-csv, empty, and already-posted ledgers are refused', async () => {
		const h = harness();
		await expect(h.service.import(ctx, 'ar', '2026-10-31', csv('x', 'a.xlsx'))).rejects.toThrow(OpeningSubledgerFileError);
		await expect(h.service.import(ctx, 'ar', '2026-10-31', csv(''))).rejects.toThrow(OpeningSubledgerFileError);
		h.items.push({ id: 'p', ledger: 'ar', postedAt: 1, deletedAt: null });
		await expect(h.service.import(ctx, 'ar', '2026-10-31', csv('CUS-1,X,2026-09-01,,1'))).rejects.toThrow(OpeningSubledgerPostedError);
	});
});

describe('tie to the control accounts', () => {
	test('posting is refused while a ledger total differs from its control row', async () => {
		const h = harness();
		await h.service.import(ctx, 'ar', '2026-10-31', csv('CUS-1,INV-1,2026-09-30,,1000000'));
		await expect(h.service.assertTied('org-1', '2026-10-31', [row('acc-ar', rp(900_000), 0)])).rejects.toThrow(OpeningSubledgerMismatchError);
		// A control balance with no detail is refused too.
		await expect(h.service.assertTied('org-1', '2026-10-31', [row('acc-ar', rp(1_000_000), 0), row('acc-ap', 0, rp(5))])).rejects.toThrow(
			OpeningSubledgerMismatchError,
		);
		await expect(h.service.assertTied('org-1', '2026-09-30', [row('acc-ar', rp(1_000_000), 0)])).rejects.toThrow(OpeningSubledgerDateError);
		const drafts = await h.service.assertTied('org-1', '2026-10-31', [row('acc-ar', rp(1_000_000), 0), row('acc-cash', 0, rp(1_000_000))]);
		expect(drafts).toHaveLength(1);
	});

	test('materialising creates AR open items and approved opening bills with AP open items', async () => {
		const h = harness();
		await h.service.import(ctx, 'ar', '2026-10-31', csv('CUS-1,INV-1,2026-09-30,2026-10-30,1000000'));
		await h.service.import(ctx, 'ap', '2026-10-31', csv('SUP-1,SUP-INV-9,2026-10-01,2026-11-01,400000'));
		const drafts = await h.service.assertTied('org-1', '2026-10-31', [row('acc-ar', rp(1_000_000), 0), row('acc-ap', 0, rp(400_000)), row('acc-eq', 0, rp(600_000))]);
		await h.service.materialize({} as never, ctx, drafts);
		expect(h.arItems[0]).toMatchObject({ invoiceId: null, customerId: 'cus-1', originalAmount: rp(1_000_000), outstandingAmount: rp(1_000_000), status: 'open' });
		expect(h.bills[0]).toMatchObject({ code: 'BILL-0001', supplierCompanyId: 'sup-1', supplierInvoiceNumber: 'SUP-INV-9', grandTotal: rp(400_000), status: 'approved', purchaseOrderId: null });
		expect(h.apItems[0]).toMatchObject({ supplierBillId: 'bill-1', outstandingAmount: rp(400_000), status: 'open' });
		expect(h.items.filter((item) => !item.deletedAt).every((item) => item.postedAt === 1)).toBe(true);
		expect(h.items.find((item) => item.ledger === 'ap')).toMatchObject({ supplierBillId: 'bill-1', apOpenItemId: 'ap-1' });
	});
});
