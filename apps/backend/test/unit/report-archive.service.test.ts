/**
 * Monthly report archive (M12 T30): a closed month freezes the three
 * statements, an open one is refused, and a repeat close writes nothing.
 */
import { describe, expect, test } from 'bun:test';
import type { TAccountingPeriodSelect } from '../../drizzle/schemas/finance.schema';
import { ReportArchiveService } from '../../src/app/finance/services/report-archive.service';
import {
	PeriodNotFoundError,
	ReportArchiveNotFoundError,
	ReportArchivePeriodOpenError,
} from '../../src/app/finance/errors/ledger.errors';

type TArchiveRow = { reportType: string; payload: unknown };

const period = (status: string): TAccountingPeriodSelect =>
	({ id: 'p1', status }) as TAccountingPeriodSelect;

const makeService = (options: {
	status?: string | null;
	existing?: TArchiveRow[];
	payloads?: { pl?: unknown; bs?: unknown; cf?: unknown };
}) => {
	const inserted: TArchiveRow[] = [];
	const seen: Array<{ year: number; month: number }> = [];
	const payloads = options.payloads ?? {
		pl: { netIncome: 1 },
		bs: { totalAssets: 2 },
		cf: { netChangeInCash: 3 },
	};
	const service = new ReportArchiveService(
		{
			async insert(input: { reportType: string; payload: unknown }) {
				if ((options.existing ?? []).some((row) => row.reportType === input.reportType)) {
					return null;
				}
				inserted.push({ reportType: input.reportType, payload: input.payload });
				return { id: input.reportType, ...input } as never;
			},
			async findById() {
				return null;
			},
		} as never,
		{
			async findPeriodByMonth(_org: string, year: number, month: number) {
				seen.push({ year, month });
				return options.status === null ? null : period(options.status ?? 'closed');
			},
		} as never,
		{
			async profitAndLoss() {
				return payloads.pl;
			},
			async balanceSheet() {
				return payloads.bs;
			},
			async cashFlow() {
				return payloads.cf;
			},
		} as never,
	);
	return { service, inserted, seen };
};

describe('report archive', () => {
	test('freezes the three statements of a closed month', async () => {
		const { service, inserted, seen } = makeService({ status: 'closed' });
		const created = await service.archivePeriod(
			{ organizationId: 'o1', actorUserId: 'u1' },
			2026,
			10,
		);
		expect(seen).toEqual([{ year: 2026, month: 10 }]);
		expect(inserted.map((row) => row.reportType)).toEqual([
			'profit_and_loss',
			'balance_sheet',
			'cash_flow',
		]);
		expect(created).toHaveLength(3);
	});

	test('accepts a locked month', async () => {
		const { service, inserted } = makeService({ status: 'locked' });
		await service.archivePeriod({ organizationId: 'o1', actorUserId: 'u1' }, 2026, 9);
		expect(inserted).toHaveLength(3);
	});

	test('refuses an open month', async () => {
		const { service, inserted } = makeService({ status: 'open' });
		await expect(
			service.archivePeriod({ organizationId: 'o1', actorUserId: 'u1' }, 2026, 11),
		).rejects.toBeInstanceOf(ReportArchivePeriodOpenError);
		expect(inserted).toHaveLength(0);
	});

	test('refuses a month with no period row', async () => {
		const { service } = makeService({ status: null });
		await expect(
			service.archivePeriod({ organizationId: 'o1', actorUserId: 'u1' }, 2026, 12),
		).rejects.toBeInstanceOf(PeriodNotFoundError);
	});

	test('a repeat close writes nothing new', async () => {
		const { service, inserted } = makeService({
			status: 'closed',
			existing: [
				{ reportType: 'profit_and_loss', payload: {} },
				{ reportType: 'balance_sheet', payload: {} },
				{ reportType: 'cash_flow', payload: {} },
			],
		});
		const created = await service.archivePeriod(
			{ organizationId: 'o1', actorUserId: 'u1' },
			2026,
			10,
		);
		expect(created).toEqual([]);
		expect(inserted).toHaveLength(0);
	});

	test('get throws when the archive is missing', async () => {
		const { service } = makeService({ status: 'closed' });
		await expect(service.get('o1', 'nope')).rejects.toBeInstanceOf(
			ReportArchiveNotFoundError,
		);
	});
});
