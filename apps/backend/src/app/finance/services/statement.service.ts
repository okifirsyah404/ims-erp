import type { TChartOfAccountSelect } from '@drizzle/schemas/finance.schema';
import { inject, injectable } from 'tsyringe';
import { CHART_OF_ACCOUNT_REPOSITORY_TOKEN, STATEMENT_REPOSITORY_TOKEN } from '../constants/di';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type { IStatementRepository, TCashFlowSection, TStatementLine } from '../contracts/statement.contract';

type TCategory = 'operating' | 'investing' | 'financing';
const DAY = 86_400_000;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const minusYear = (date: string) => {
	const [y, m, d] = date.split('-').map(Number) as [number, number, number];
	const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
	return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};
/** Whole calendar months compare with the same number of preceding months; other ranges with the same number of days before. */
function previousPeriod(from: string, to: string): { from: string; to: string } {
	const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
	const [ty, tm] = to.split('-').map(Number) as [number, number];
	const monthEnd = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);
	if (fd === 1 && to === monthEnd) {
		const months = ty * 12 + tm - (fy * 12 + fm) + 1;
		const start = new Date(Date.UTC(fy, fm - 1 - months, 1)).toISOString().slice(0, 10);
		return { from: start, to: shift(from, -1) };
	}
	const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
	return { from: shift(from, -(days + 1)), to: shift(from, -1) };
}
const isPl = (account: TChartOfAccountSelect) => account.accountType === 'revenue' || account.accountType === 'expense';
/** Contra assets (accumulated depreciation) carry a credit normal balance. */
const isContraAsset = (account: TChartOfAccountSelect) => account.accountType === 'asset' && account.normalBalance === 'credit';

/**
 * Financial statements beyond the ERP-0133 set (ERP-0148): the direct cash
 * flow (primary), the indirect reconciliation, the statement of changes in
 * equity, and comparatives.
 *
 * @remarks
 * Direct: every posted entry touching a cash account (Kas dan Setara Kas or a
 * GL account linked to a cash/bank account) contributes its non-cash lines;
 * in a balanced entry their credit - debit is exactly the cash they moved, so
 * cash-to-cash transfers vanish and no allocation is needed. Lines are
 * grouped by counterpart account under its cash-flow category (P&L accounts
 * and uncategorised accounts count as operating).
 * Indirect: net income plus the period movement (credit - debit) of every
 * non-cash balance-sheet account; contra assets (accumulated depreciation)
 * are a non-cash operating adjustment. Both methods equal the change in cash
 * by double entry, and the closing cash is tied to the balance sheet.
 */
@injectable()
export class StatementService {
	constructor(
		@inject(STATEMENT_REPOSITORY_TOKEN) private readonly repo: IStatementRepository,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: Pick<IChartOfAccountRepository, 'listAccountsMap'>,
	) {}

	private category(account: TChartOfAccountSelect): TCategory {
		if (isPl(account) || isContraAsset(account)) return 'operating';
		if (account.cashFlowCategory) return account.cashFlowCategory as TCategory;
		return account.accountType === 'equity' ? 'financing' : 'operating';
	}

	private section(lines: TStatementLine[]): TCashFlowSection {
		const sorted = lines.filter((line) => line.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
		return { lines: sorted, total: sorted.reduce((sum, line) => sum + line.amount, 0) };
	}

	private async cashBalance(organizationId: string, cashIds: string[], date: string): Promise<number> {
		const ids = new Set(cashIds);
		return (await this.repo.activity(organizationId, '0001-01-01', date))
			.filter((row) => ids.has(row.accountId))
			.reduce((sum, row) => sum + row.debit - row.credit, 0);
	}

	async build(organizationId: string, from: string, to: string) {
		const accounts = (await this.accounts.listAccountsMap(organizationId)) as Map<string, TChartOfAccountSelect>;
		const cashIds = await this.repo.cashAccountIds(organizationId);
		const cash = new Set(cashIds);
		const line = (accountId: string, amount: number): TStatementLine => {
			const account = accounts.get(accountId);
			return { accountId, code: account?.code ?? '?', name: account?.name ?? accountId, amount };
		};

		// Direct method.
		const direct: Record<TCategory, TStatementLine[]> = { operating: [], investing: [], financing: [] };
		for (const row of await this.repo.cashCounterparts(organizationId, cashIds, from, to)) {
			const account = accounts.get(row.accountId);
			direct[account ? this.category(account) : 'operating'].push(line(row.accountId, row.inflow));
		}
		const directSections = {
			operating: this.section(direct.operating),
			investing: this.section(direct.investing),
			financing: this.section(direct.financing),
		};
		const netChange = directSections.operating.total + directSections.investing.total + directSections.financing.total;
		const openingCash = await this.cashBalance(organizationId, cashIds, shift(from, -1));
		const closingCash = await this.cashBalance(organizationId, cashIds, to);

		// Indirect method and equity, from the period activity.
		const period = await this.repo.activity(organizationId, from, to);
		let netIncome = 0;
		const indirect: Record<TCategory | 'adjustments', TStatementLine[]> = { adjustments: [], operating: [], investing: [], financing: [] };
		for (const row of period) {
			const account = accounts.get(row.accountId);
			if (!account || cash.has(row.accountId)) continue;
			const movement = row.credit - row.debit;
			if (isPl(account)) {
				netIncome += movement;
				continue;
			}
			if (isContraAsset(account)) indirect.adjustments.push(line(row.accountId, movement));
			else indirect[this.category(account)].push(line(row.accountId, movement));
		}
		const adjustments = this.section(indirect.adjustments);
		const workingCapital = this.section(indirect.operating);
		const indirectView = {
			netIncome,
			adjustments,
			workingCapital,
			operating: netIncome + adjustments.total + workingCapital.total,
			investing: this.section(indirect.investing),
			financing: this.section(indirect.financing),
		};

		// Changes in equity: opening + movements + results not yet closed.
		const before = await this.repo.activity(organizationId, '0001-01-01', shift(from, -1));
		const equityRows = new Map<string, { opening: number; increase: number; decrease: number }>();
		let priorResult = 0;
		for (const row of before) {
			const account = accounts.get(row.accountId);
			if (!account) continue;
			if (isPl(account)) priorResult += row.credit - row.debit;
			else if (account.accountType === 'equity') equityRows.set(row.accountId, { opening: row.credit - row.debit, increase: 0, decrease: 0 });
		}
		for (const row of period) {
			const account = accounts.get(row.accountId);
			if (account?.accountType !== 'equity') continue;
			const current = equityRows.get(row.accountId) ?? { opening: 0, increase: 0, decrease: 0 };
			current.increase += row.credit;
			current.decrease += row.debit;
			equityRows.set(row.accountId, current);
		}
		const equityLines = [...equityRows]
			.map(([accountId, value]) => ({ ...line(accountId, 0), opening: value.opening, increase: value.increase, decrease: value.decrease, closing: value.opening + value.increase - value.decrease }))
			.filter((row) => row.opening !== 0 || row.increase !== 0 || row.decrease !== 0)
			.sort((a, b) => a.code.localeCompare(b.code))
			.map(({ amount: _amount, ...rest }) => rest);
		const equityOpening = equityLines.reduce((sum, row) => sum + row.opening, 0) + priorResult;
		const equityClosing = equityLines.reduce((sum, row) => sum + row.closing, 0) + priorResult + netIncome;

		return {
			from,
			to,
			directCashFlow: {
				...directSections,
				netChange,
				openingCash,
				closingCash,
				/** Zero when the direct statement ties to the balance-sheet cash. */
				tieDifference: openingCash + netChange - closingCash,
			},
			indirectCashFlow: {
				...indirectView,
				netChange: indirectView.operating + indirectView.investing.total + indirectView.financing.total,
			},
			changesInEquity: {
				lines: equityLines,
				unclosedPriorResult: priorResult,
				periodResult: netIncome,
				opening: equityOpening,
				closing: equityClosing,
			},
		};
	}

	/** The statements for a range, with the comparative range when asked. */
	async statements(organizationId: string, from: string, to: string, compare: 'none' | 'previous_period' | 'previous_year') {
		const current = await this.build(organizationId, from, to);
		if (compare === 'none') return { current, comparative: null };
		const range = compare === 'previous_year' ? { from: minusYear(from), to: minusYear(to) } : previousPeriod(from, to);
		return { current, comparative: await this.build(organizationId, range.from, range.to) };
	}
}
