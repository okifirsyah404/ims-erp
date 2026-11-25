/**
 * Fixed assets in the GL (ERP-0145): depreciation arithmetic, fiscal groups,
 * capitalization, the monthly run and the disposal journal.
 */
import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { FixedAssetService } from '../../src/app/finance/services/fixed-asset.service';
import { FixedAssetBookExistsError, FixedAssetItemError } from '../../src/app/finance/errors/fixed-asset.errors';
import { fiscalDepreciation, monthlyDepreciation } from '../../src/app/finance/utils/depreciation';

const rp = (rupiah: number) => rupiah * 100;

describe('commercial depreciation', () => {
	const base = { cost: rp(12_000_000), salvage: 0, bookValue: rp(12_000_000), usefulLifeMonths: 12, monthsElapsed: 0 };
	test('straight line, double declining, salvage floor, last month takes the rest', () => {
		expect(monthlyDepreciation({ ...base, method: 'straight_line' })).toBe(rp(1_000_000));
		expect(monthlyDepreciation({ ...base, method: 'declining_balance' })).toBe(rp(2_000_000));
		expect(monthlyDepreciation({ ...base, method: 'straight_line', bookValue: rp(1_300_000), monthsElapsed: 11 })).toBe(rp(1_300_000));
		expect(monthlyDepreciation({ ...base, method: 'straight_line', salvage: rp(11_500_000) })).toBe(rp(41_666));
		expect(monthlyDepreciation({ ...base, method: 'none' })).toBe(0);
	});
});

describe('fiscal depreciation (UU PPh Pasal 11)', () => {
	const cost = rp(100_000_000);
	test('kelompok 2 from April: first year pro-rated by months', () => {
		expect(fiscalDepreciation({ cost, capitalizedOn: '2026-04-15', group: 'kelompok_2', method: 'straight_line', year: 2026 })).toEqual({
			method: 'straight_line',
			accumulatedBefore: 0,
			yearAmount: rp(9_375_000),
		});
		expect(fiscalDepreciation({ cost, capitalizedOn: '2026-04-15', group: 'kelompok_2', method: 'declining_balance', year: 2027 })).toEqual({
			method: 'declining_balance',
			accumulatedBefore: rp(18_750_000),
			yearAmount: rp(20_312_500),
		});
	});

	test('the last year of the useful life takes the remaining book value', () => {
		expect(fiscalDepreciation({ cost, capitalizedOn: '2026-01-10', group: 'kelompok_1', method: 'declining_balance', year: 2029 }).yearAmount).toBe(rp(12_500_000));
		expect(fiscalDepreciation({ cost, capitalizedOn: '2026-07-01', group: 'kelompok_1', method: 'straight_line', year: 2030 })).toEqual({
			method: 'straight_line',
			accumulatedBefore: rp(87_500_000),
			yearAmount: rp(12_500_000),
		});
		expect(fiscalDepreciation({ cost, capitalizedOn: '2026-07-01', group: 'kelompok_1', method: 'straight_line', year: 2031 }).yearAmount).toBe(0);
	});

	test('buildings are straight line even when declining balance is asked', () => {
		expect(fiscalDepreciation({ cost, capitalizedOn: '2026-01-01', group: 'bangunan_permanen', method: 'declining_balance', year: 2026 })).toEqual({
			method: 'straight_line',
			accumulatedBefore: 0,
			yearAmount: rp(5_000_000),
		});
	});
});

describe('FixedAssetService', () => {
	function harness() {
		const items = new Map<string, Record<string, any>>([
			[
				'item-1',
				{ id: 'item-1', organizationId: 'org-1', code: 'AST-1', name: 'Mobil operasional', itemKind: 'vehicle', status: 'ready', acquisitionCost: rp(120_000_000), salvageValue: 0, bookValue: rp(120_000_000), accumulatedDepreciation: 0, usefulLifeMonths: 96, depreciationMethod: 'straight_line', depreciationStartedOn: null },
			],
			['item-2', { id: 'item-2', organizationId: 'org-1', code: 'AST-2', acquisitionCost: 0, status: 'ready' }],
		]);
		const books: Array<Record<string, any>> = [];
		const entries: Array<Record<string, any>> = [];
		const posted: Array<{ lines: Array<Record<string, any>>; idempotencyKey: string; sourceModule: string }> = [];
		const service = new FixedAssetService(
			{
				list: async () => books as never,
				findByItem: async (_o: string, itemId: string) => (books.find((b) => b.itemId === itemId) ?? null) as never,
				insert: async (row: Record<string, unknown>) => {
					const created = { ...row, id: `book-${books.length + 1}` };
					books.push(created);
					return created as never;
				},
				update: async (_o: string, id: string, patch: Record<string, unknown>) => Object.assign(books.find((b) => b.id === id)!, patch) as never,
			},
			{
				findPeriod: async (itemId: string, y: number, m: number) => (entries.find((e) => e.itemId === itemId && e.periodYear === y && e.periodMonth === m) ?? null) as never,
				create: async (row: Record<string, unknown>) => {
					entries.push(row);
					return row as never;
				},
				listForItem: async (itemId: string) => entries.filter((e) => e.itemId === itemId) as never,
			},
			{
				getItem: async (id: string) => items.get(id) as never,
				applyDepreciation: async (id: string, _o: string, amount: number) => {
					const item = items.get(id)!;
					item.bookValue -= amount;
					item.accumulatedDepreciation += amount;
					return item as never;
				},
			},
			{ findAccountById: async (_o: string, id: string) => ({ id, isPostable: true, isActive: true }) as never },
			{
				resolveAccountId: async (_o: string, lookup: { role: string; discriminatorValue?: string | null }) =>
					`acc-${lookup.role}${lookup.discriminatorValue ? `-${lookup.discriminatorValue}` : ''}`,
			},
			{
				post: async (_tx: unknown, input: never) => {
					posted.push(input);
					return { entry: { id: `je-${posted.length}` } } as never;
				},
			} as never,
			{ run: <T>(work: (tx: never) => Promise<T>) => work({} as never) } as never,
		);
		return { service, items, books, entries, posted };
	}
	const ctx = { organizationId: 'org-1', actorUserId: 'acc' };

	test('capitalization posts Dr fixed asset by item kind / Cr counterpart, once', async () => {
		const h = harness();
		const view = await h.service.capitalize(ctx, 'item-1', { capitalizedOn: '2026-10-01', counterpartAccountId: 'acc-grir', fiscalGroup: 'kelompok_2' });
		expect(view).toMatchObject({ itemCode: 'AST-1', capitalizedAmount: rp(120_000_000), capitalizationEntryId: 'je-1', status: 'active' });
		expect(h.posted[0]!.lines).toEqual([
			{ accountId: 'acc-fixed_asset-vehicle', debit: rp(120_000_000), credit: 0 },
			{ accountId: 'acc-grir', debit: 0, credit: rp(120_000_000) },
		]);
		await expect(h.service.capitalize(ctx, 'item-1', { capitalizedOn: '2026-10-01', counterpartAccountId: 'x', fiscalGroup: null })).rejects.toThrow(FixedAssetBookExistsError);
		await expect(h.service.capitalize(ctx, 'item-2', { capitalizedOn: '2026-10-01', counterpartAccountId: 'x', fiscalGroup: null })).rejects.toThrow(FixedAssetItemError);
	});

	test('monthly run: one journal, entries stamped, rerun posts nothing', async () => {
		const h = harness();
		await h.service.capitalize(ctx, 'item-1', { capitalizedOn: '2026-10-01', counterpartAccountId: 'acc-grir', fiscalGroup: 'kelompok_2' });
		expect(await h.service.runMonth(ctx, 2026, 9)).toEqual({ depreciated: 0, total: 0, journalEntryId: null });
		const run = await h.service.runMonth(ctx, 2026, 10);
		expect(run).toEqual({ depreciated: 1, total: rp(1_250_000), journalEntryId: 'je-2' });
		expect(h.posted[1]!.lines).toEqual([
			{ accountId: 'acc-depreciation_expense', debit: rp(1_250_000), credit: 0 },
			{ accountId: 'acc-accumulated_depreciation-vehicle', debit: 0, credit: rp(1_250_000) },
		]);
		expect(h.entries[0]).toMatchObject({ periodYear: 2026, periodMonth: 10, depreciationAmount: rp(1_250_000), journalEntryId: 'je-2', closingBookValue: rp(118_750_000) });
		expect((await h.service.runMonth(ctx, 2026, 10)).depreciated).toBe(0);
		const report = await h.service.fiscalReport('org-1', 2026);
		expect(report.rows[0]).toMatchObject({ fiscalDepreciation: rp(3_750_000), commercialDepreciation: rp(1_250_000), difference: rp(2_500_000) });
	});

	test('disposal: accumulated and cost out, loss or gain balances, book closed', async () => {
		const h = harness();
		await h.service.capitalize(ctx, 'item-1', { capitalizedOn: '2026-10-01', counterpartAccountId: 'acc-grir', fiscalGroup: null });
		const disposal = { organizationId: 'org-1', actorUserId: 'acc', itemId: 'item-1', itemCode: 'AST-1', itemKind: 'vehicle', disposalId: 'dsp-1', disposalDate: '2026-12-01' };
		await h.service.postDisposal({} as never, { ...disposal, acquisitionCost: rp(120_000_000), accumulatedDepreciation: rp(20_000_000), proceeds: rp(90_000_000) });
		expect(h.posted[1]!.lines).toEqual([
			{ accountId: 'acc-accumulated_depreciation-vehicle', debit: rp(20_000_000), credit: 0 },
			{ accountId: 'acc-disposal_receivable', debit: rp(90_000_000), credit: 0 },
			{ accountId: 'acc-asset_disposal_loss', debit: rp(10_000_000), credit: 0 },
			{ accountId: 'acc-fixed_asset-vehicle', debit: 0, credit: rp(120_000_000) },
		]);
		expect(h.posted[1]!.sourceModule).toBe('inventory');
		expect(h.books[0]).toMatchObject({ status: 'disposed', disposalEntryId: 'je-2' });
		expect(await h.service.postDisposal({} as never, { ...disposal, disposalId: 'dsp-2', acquisitionCost: 1, accumulatedDepreciation: 0, proceeds: 0 })).toBeNull();
	});
});
