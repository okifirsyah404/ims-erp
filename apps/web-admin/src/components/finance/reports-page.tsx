import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { CostCenterPlReport, ProjectCostingReport } from './cost-reports';
import { StatementsReport } from './statements-report';
import { CashForecastReport } from './cash-forecast-report';
import { ProfitabilityReport } from './profitability-report';
import { RatiosReport } from './ratios-report';
import { ManagementPackReport } from './management-pack-report';
import { Button } from '@ims-erp/ui/components/button';
import { useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import {
	balanceSheetQueryOptions,
	cashFlowQueryOptions,
	profitAndLossQueryOptions,
} from '@/lib/finance-api';
import { downloadFile } from '@/lib/download';
import { usePermission } from '@/lib/use-permission';
import { GeneralLedgerReport, TrialBalanceReport } from './ledger-reports';

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

const today = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => `${today().slice(0, 7)}-01`;

/** Financial reports: P&L, balance sheet, direct-method cash flow (F6). */
export function ReportsPage() {
	const { t } = useTranslation(['finance', 'common']);
	const canRead = usePermission('financial_report.read');

	const [startDate, setStartDate] = useState(startOfMonth());
	const [endDate, setEndDate] = useState(today());
	const [asOfDate, setAsOfDate] = useState(today());

	const [applied, setApplied] = useState({ startDate: '', endDate: '', asOfDate: '' });

	const run = () => setApplied({ startDate, endDate, asOfDate });

	const { data: pl } = useQuery({
		...profitAndLossQueryOptions(applied.startDate, applied.endDate),
		enabled: canRead && applied.startDate !== '' && applied.startDate <= applied.endDate,
	});

	const { data: bs } = useQuery({
		...balanceSheetQueryOptions(applied.asOfDate),
		enabled: canRead && applied.asOfDate !== '',
	});

	const { data: cf } = useQuery({
		...cashFlowQueryOptions(applied.startDate, applied.endDate),
		enabled: canRead && applied.startDate !== '' && applied.startDate <= applied.endDate,
	});

	if (!canRead) {
		return (
			<EmptyState icon={FileSpreadsheet} title={t('finance:reports.title')} bordered />
		);
	}

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:reports.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:reports.description')}
				</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<DatePicker
					className='w-40'
					value={startDate}
					onChange={setStartDate}
				/>
				<DatePicker
					className='w-40'
					value={endDate}
					onChange={setEndDate}
				/>
				<DatePicker
					className='w-40'
					value={asOfDate}
					onChange={setAsOfDate}
				/>
				<Button size='sm' onClick={run}>
					{t('finance:reports.run')}
				</Button>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<ExportButton
					disabled={applied.startDate === ''}
					onClick={() =>
						downloadFile(
							`/reports/profit-and-loss.csv?startDate=${applied.startDate}&endDate=${applied.endDate}`,
							`profit-and-loss-${applied.startDate}_${applied.endDate}.csv`,
						)
					}
				/>
				<ExportButton
					disabled={applied.asOfDate === ''}
					onClick={() =>
						downloadFile(
							`/reports/balance-sheet.csv?asOfDate=${applied.asOfDate}`,
							`balance-sheet-${applied.asOfDate}.csv`,
						)
					}
				/>
				<ExportButton
					disabled={applied.startDate === ''}
					onClick={() =>
						downloadFile(
							`/reports/cash-flow.csv?startDate=${applied.startDate}&endDate=${applied.endDate}`,
							`cash-flow-${applied.startDate}_${applied.endDate}.csv`,
						)
					}
				/>
			</div>

			<Tabs defaultValue='pl'>
				<TabsList>
					<TabsTrigger value='pl'>{t('finance:reports.tab.pl')}</TabsTrigger>
					<TabsTrigger value='bs'>{t('finance:reports.tab.balanceSheet')}</TabsTrigger>
					<TabsTrigger value='cf'>{t('finance:reports.tab.cashFlow')}</TabsTrigger>
					<TabsTrigger value='tb'>{t('finance:reports.tab.trialBalance')}</TabsTrigger>
					<TabsTrigger value='gl'>{t('finance:reports.tab.generalLedger')}</TabsTrigger>
					<TabsTrigger value='pack'>{t('finance:reports.tab.pack')}</TabsTrigger>
					<TabsTrigger value='forecast'>{t('finance:reports.tab.forecast')}</TabsTrigger>
					<TabsTrigger value='statements'>{t('finance:reports.tab.statements')}</TabsTrigger>
					<TabsTrigger value='ratios'>{t('finance:reports.tab.ratios')}</TabsTrigger>
					<TabsTrigger value='profitability'>{t('finance:reports.tab.profitability')}</TabsTrigger>
					<TabsTrigger value='projects'>{t('finance:reports.tab.projectCosting')}</TabsTrigger>
					<TabsTrigger value='cost-centers'>{t('finance:reports.tab.costCenters')}</TabsTrigger>
				</TabsList>

				<TabsContent value='tb' className='space-y-3'>
					<TrialBalanceReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='gl' className='space-y-3'>
					<GeneralLedgerReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='pack' className='space-y-3'>
					<ManagementPackReport />
				</TabsContent>

				<TabsContent value='forecast' className='space-y-3'>
					<CashForecastReport />
				</TabsContent>

				<TabsContent value='statements' className='space-y-3'>
					<StatementsReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='ratios' className='space-y-3'>
					<RatiosReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='profitability' className='space-y-3'>
					<ProfitabilityReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='projects' className='space-y-3'>
					<ProjectCostingReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='cost-centers' className='space-y-3'>
					<CostCenterPlReport startDate={applied.startDate} endDate={applied.endDate} />
				</TabsContent>

				<TabsContent value='pl' className='space-y-3'>
					{pl ? (
						<>
							<ReportSection
								title={t('finance:reports.pl.revenue')}
								rows={pl.revenue}
								total={pl.totalRevenue}
							/>
							<ReportSection
								title={t('finance:reports.pl.expenses')}
								rows={pl.expenses}
								total={pl.totalExpenses}
							/>
							<Card>
								<CardHeader>
									<CardTitle>
										{t('finance:reports.pl.netIncome')}
									</CardTitle>
								</CardHeader>
								<CardContent className='text-lg font-semibold'>
									{formatMoney(pl.netIncome)}
								</CardContent>
							</Card>
						</>
					) : (
						<EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} bordered />
					)}
				</TabsContent>

				<TabsContent value='bs' className='space-y-3'>
					{bs ? (
						<>
							<ReportSection
								title={t('finance:reports.bs.assets')}
								rows={bs.assets}
								total={bs.totalAssets}
							/>
							<ReportSection
								title={t('finance:reports.bs.liabilities')}
								rows={bs.liabilities}
								total={bs.totalLiabilities}
							/>
							<ReportSection
								title={t('finance:reports.bs.equity')}
								rows={bs.equity}
								total={bs.totalEquity}
							/>
							{bs.unexplained !== 0 ? (
								<Card>
									<CardHeader>
										<CardTitle className='text-destructive'>
											{t('finance:reports.bs.unexplained')}
										</CardTitle>
									</CardHeader>
									<CardContent>{formatMoney(bs.unexplained)}</CardContent>
								</Card>
							) : null}
						</>
					) : (
						<EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} bordered />
					)}
				</TabsContent>

				<TabsContent value='cf' className='space-y-3'>
					{cf ? (
						<>
							<ReportSection
								title={t('finance:reports.cf.operating')}
								rows={cf.operating.map((entry) => ({
									code: entry.code,
									name: entry.name,
									amount: entry.amount,
								}))}
								total={cf.netOperating}
							/>
							<ReportSection
								title={t('finance:reports.cf.investing')}
								rows={cf.investing.map((entry) => ({
									code: entry.code,
									name: entry.name,
									amount: entry.amount,
								}))}
								total={cf.netInvesting}
							/>
							<ReportSection
								title={t('finance:reports.cf.financing')}
								rows={cf.financing.map((entry) => ({
									code: entry.code,
									name: entry.name,
									amount: entry.amount,
								}))}
								total={cf.netFinancing}
							/>
							<Card>
								<CardHeader>
									<CardTitle>
										{t('finance:reports.cf.netChange')}
									</CardTitle>
								</CardHeader>
								<CardContent className='text-lg font-semibold'>
									{formatMoney(cf.netChangeInCash)}
								</CardContent>
							</Card>
						</>
					) : (
						<EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} bordered />
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ExportButton({
	disabled,
	onClick,
}: {
	disabled: boolean;
	onClick: () => Promise<void>;
}) {
	const { t } = useTranslation('finance');
	const canExport = usePermission('financial_report.export');
	if (!canExport) return null;
	return (
		<Button
			size='sm'
			variant='outline'
			disabled={disabled}
			onClick={() => void onClick()}
		>
			<Download className='size-4' />
			{t('reports.export')}
		</Button>
	);
}

function ReportSection({	title,
	rows,
	total,
}: {
	title: string;
	rows: Array<{ code: string; name: string; amount: number }>;
	total: number;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className='text-muted-foreground text-sm'>—</p>
				) : (
					<div className='space-y-1'>
						{rows.map((row) => (
							<div key={row.code} className='flex justify-between text-sm'>
								<span className='font-mono text-xs'>
									{row.code} — {row.name}
								</span>
								<span>{formatMoney(row.amount)}</span>
							</div>
						))}
						<div className='flex justify-between border-t pt-1 text-sm font-medium'>
							<span>{title}</span>
							<span>{formatMoney(total)}</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
