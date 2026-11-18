import { inject, injectable } from 'tsyringe';
import { JOURNAL_REPOSITORY_TOKEN, CHART_OF_ACCOUNT_REPOSITORY_TOKEN } from '../constants/di';
import type { TChartOfAccountSelect } from '@drizzle/schemas/accounting.schema';
import type { IJournalRepository } from '../contracts/journal.repository.interface';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';

export type TReportContext = {
	organizationId: string;
};

export type TReportLine = {
	accountId: string;
	code: string;
	name: string;
	accountType: string;
	amount: number;
};

export type TProfitAndLoss = {
	startDate: string;
	endDate: string;
	revenue: TReportLine[];
	expenses: TReportLine[];
	totalRevenue: number;
	totalExpenses: number;
	netIncome: number;
};

export type TBalanceSheet = {
	asOfDate: string;
	assets: TReportLine[];
	liabilities: TReportLine[];
	equity: TReportLine[];
	totalAssets: number;
	totalLiabilities: number;
	totalEquity: number;
	/** assets − (liabilities + equity); 0 when the books balance. */
	unexplained: number;
};

export type TCashFlowEntry = {
	accountId: string;
	code: string;
	name: string;
	cashFlowCategory: string;
	amount: number;
};

export type TCashFlowStatement = {
	startDate: string;
	endDate: string;
	operating: TCashFlowEntry[];
	investing: TCashFlowEntry[];
	financing: TCashFlowEntry[];
	netOperating: number;
	netInvesting: number;
	netFinancing: number;
	netChangeInCash: number;
};

const REPORT_ACCOUNT_TYPES = {
	/** Account types that sum into P&L (closed into equity at year end). */
	incomeStatement: ['revenue', 'expense'],
	/** Account types that sum into the balance sheet (running balances). */
	balanceSheet: ['asset', 'liability', 'equity'],
} as const;

/**
 * Financial report builder (M09 F6, D7).
 *
 * @remarks
 * Reports are computed on demand from `journal_lines` — the ledger is the
 * single source of truth. `account_balances` exists only as the close-time
 * snapshot written by the period service and is never read here. Reversal
 * entries participate as ordinary posted rows, so corrections flow through
 * naturally. Amounts follow each account's `normalBalance`: revenue and
 * liabilities report credit-side totals, expenses and assets debit-side.
 */
@injectable()
export class ReportService {
	constructor(
				@inject(JOURNAL_REPOSITORY_TOKEN) private readonly journal: IJournalRepository,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: IChartOfAccountRepository,
	) {}

	/** Income statement: revenue − expenses over a date range. */
	async profitAndLoss(
		ctx: TReportContext,
		startDate: string,
		endDate: string,
	): Promise<TProfitAndLoss> {
		const accounts = await this.accounts.listAccountsMap(ctx.organizationId);
		const activity = await this.journal.listAccountActivity(
			ctx.organizationId,
			startDate,
			endDate,
		);
		const revenue: TReportLine[] = [];
		const expenses: TReportLine[] = [];
		let totalRevenue = 0;
		let totalExpenses = 0;
		for (const row of activity) {
			const account = accounts.get(row.accountId);
			if (!account) continue;
			const amount = this.signedAmount(account, row.debit, row.credit);
			if (amount === 0) continue;
			const line: TReportLine = {
				accountId: account.id,
				code: account.code,
				name: account.name,
				accountType: account.accountType,
				amount,
			};
			if (account.accountType === 'revenue') {
				revenue.push(line);
				totalRevenue += amount;
			} else if (account.accountType === 'expense') {
				expenses.push(line);
				totalExpenses += amount;
			}
		}
		return {
			startDate,
			endDate,
			revenue,
			expenses,
			totalRevenue,
			totalExpenses,
			netIncome: totalRevenue - totalExpenses,
		};
	}

	/** Balance sheet as of a date: all posted activity up to and including it. */
	async balanceSheet(
		ctx: TReportContext,
		asOfDate: string,
	): Promise<TBalanceSheet> {
		const accounts = await this.accounts.listAccountsMap(ctx.organizationId);
		const activity = await this.journal.listAccountActivity(
			ctx.organizationId,
			'0001-01-01',
			asOfDate,
		);
		const assets: TReportLine[] = [];
		const liabilities: TReportLine[] = [];
		const equity: TReportLine[] = [];
		let totalAssets = 0;
		let totalLiabilities = 0;
		let totalEquity = 0;
		for (const row of activity) {
			const account = accounts.get(row.accountId);
			if (!account) continue;
			if (
				!REPORT_ACCOUNT_TYPES.balanceSheet.includes(
					account.accountType as 'asset' | 'liability' | 'equity',
				)
			) {
				continue;
			}
			const amount = this.signedAmount(account, row.debit, row.credit);
			if (amount === 0) continue;
			const line: TReportLine = {
				accountId: account.id,
				code: account.code,
				name: account.name,
				accountType: account.accountType,
				amount,
			};
			if (account.accountType === 'asset') {
				assets.push(line);
				totalAssets += amount;
			} else if (account.accountType === 'liability') {
				liabilities.push(line);
				totalLiabilities += amount;
			} else {
				equity.push(line);
				totalEquity += amount;
			}
		}
		// The P&L closes into equity; before a year-end close the retained
		// result is still sitting in revenue/expense accounts, so surface it
		// as the balancing figure instead of pretending the sheet is off.
		const pl = await this.profitAndLoss(ctx, '0001-01-01', asOfDate);
		const currentEarnings = pl.netIncome;
		return {
			asOfDate,
			assets,
			liabilities,
			equity,
			totalAssets,
			totalLiabilities,
			totalEquity: totalEquity + currentEarnings,
			unexplained:
				totalAssets - (totalLiabilities + totalEquity + currentEarnings),
		};
	}

	/**
	 * Direct-method cash flow: actual cash movements classified by each
	 * counterpart account's `cash_flow_category` (D11).
	 */
	async cashFlow(
		ctx: TReportContext,
		startDate: string,
		endDate: string,
	): Promise<TCashFlowStatement> {
		const accounts = await this.accounts.listAccountsMap(ctx.organizationId);
		const activity = await this.journal.listAccountActivity(
			ctx.organizationId,
			startDate,
			endDate,
		);
		const operating: TCashFlowEntry[] = [];
		const investing: TCashFlowEntry[] = [];
		const financing: TCashFlowEntry[] = [];
		let netOperating = 0;
		let netInvesting = 0;
		let netFinancing = 0;
		for (const row of activity) {
			const account = accounts.get(row.accountId);
			if (!account?.cashFlowCategory) continue;
			if (account.accountType === 'asset' && account.code.startsWith('1-1')) {
				// cash-against-cash transfers net out; the cash GL accounts
				// themselves are not cash flow categories.
				continue;
			}
			// The cash flow impact equals the *cash side* of each journal:
			// cash debited (inflow) ⇔ counterpart credited. So the flow is
			// the counterpart's credit movement minus its debit movement,
			// independent of the account's normal balance: buying equipment
			// debits the asset (outflow, negative), a loan drawdown credits
			// the liability (inflow, positive).
			const amount = row.credit - row.debit;
			const entry: TCashFlowEntry = {
				accountId: account.id,
				code: account.code,
				name: account.name,
				cashFlowCategory: account.cashFlowCategory,
				amount,
			};
			if (account.cashFlowCategory === 'operating') {
				operating.push(entry);
				netOperating += amount;
			} else if (account.cashFlowCategory === 'investing') {
				investing.push(entry);
				netInvesting += amount;
			} else if (account.cashFlowCategory === 'financing') {
				financing.push(entry);
				netFinancing += amount;
			}
		}
		return {
			startDate,
			endDate,
			operating,
			investing,
			financing,
			netOperating,
			netInvesting,
			netFinancing,
			netChangeInCash: netOperating + netInvesting + netFinancing,
		};
	}

	/** Positive along the account's normal-balance side, negative against it. */
	private signedAmount(
		account: TChartOfAccountSelect,
		debit: number,
		credit: number,
	): number {
		return account.normalBalance === 'debit' ? debit - credit : credit - debit;
	}
}
