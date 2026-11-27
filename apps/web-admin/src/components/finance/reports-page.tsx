import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field } from '@ims-erp/ui/components/field';
import { FileSpreadsheet, Download } from 'lucide-react';
import { useState } from 'react';
import { FieldLabel } from '@/components/form/field-label';
import { EmptyState } from '@/components/empty-state';
import {
	balanceSheetQueryOptions,
	cashFlowQueryOptions,
	profitAndLossQueryOptions,
} from '@/lib/finance-api';
import { downloadFile } from '@/lib/download';
import { usePermission } from '@/lib/use-permission';
import { CashForecastReport } from './cash-forecast-report';
import { CostCenterPlReport, ProjectCostingReport } from './cost-reports';
import { GeneralLedgerReport, TrialBalanceReport } from './ledger-reports';
import { ManagementPackReport } from './management-pack-report';
import { ProfitabilityReport } from './profitability-report';
import { RatiosReport } from './ratios-report';
import { StatementsReport } from './statements-report';

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

const today = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => `${today().slice(0, 7)}-01`;

/**
 * Financial reports, one section per statement (F6, ADR-0030).
 *
 * @remarks
 * One filter card drives every report: a period (from/to) for the statements
 * that measure a range, and a single "as of" date for the balance sheet. Each
 * statement card carries its own CSV export, so a button never downloads a
 * different statement than the card it sits on.
 */
export function ReportsPage() {
	const { t } = useTranslation(['finance', 'common']);
	const canRead = usePermission('financial_report.read');

	const [startDate, setStartDate] = useState(startOfMonth());
	const [endDate, setEndDate] = useState(today());
	const [asOfDate, setAsOfDate] = useState(today());

	const [applied, setApplied] = useState({
		startDate: startOfMonth(),
		endDate: today(),
		asOfDate: today(),
	});

	const run = () => setApplied({ startDate, endDate, asOfDate });

	const rangeReady = applied.startDate !== '' && applied.startDate <= applied.endDate;

	const { data: pl } = useQuery({
		...profitAndLossQueryOptions(applied.startDate, applied.endDate),
		enabled: canRead && rangeReady,
	});

	const { data: bs } = useQuery({
		...balanceSheetQueryOptions(applied.asOfDate),
		enabled: canRead && applied.asOfDate !== '',
	});

	const { data: cf } = useQuery({
		...cashFlowQueryOptions(applied.startDate, applied.endDate),
		enabled: canRead && rangeReady,
	});

	if (!canRead) {
		return (
			<EmptyState icon={FileSpreadsheet} title={t('finance:reports.title')} bordered />
		);
	}

	return (
		<div className='space-y-8'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:reports.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:reports.description')}
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('finance:reports.filter.title')}</CardTitle>
					<CardDescription>{t('finance:reports.filter.hint')}</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-wrap items-end gap-3'>
					<Field className='w-auto'>
						<FieldLabel htmlFor='reports-from'>{t('finance:reports.filter.from')}</FieldLabel>
						<DatePicker className='w-40' value={startDate} onChange={setStartDate} />
					</Field>
					<Field className='w-auto'>
						<FieldLabel htmlFor='reports-to'>{t('finance:reports.filter.to')}</FieldLabel>
						<DatePicker className='w-40' value={endDate} onChange={setEndDate} />
					</Field>
					<Field className='w-auto'>
						<FieldLabel htmlFor='reports-as-of'>{t('finance:reports.filter.asOf')}</FieldLabel>
						<DatePicker className='w-40' value={asOfDate} onChange={setAsOfDate} />
					</Field>
					<Button size='sm' onClick={run}>
						{t('finance:reports.filter.apply')}
					</Button>
				</CardContent>
			</Card>

			<section className='space-y-3'>
				<h2 className='text-lg font-semibold'>{t('finance:reports.group.financial')}</h2>

				<ReportCard
					title={t('finance:reports.tab.pl')}
					action={
						<ExportButton
							label={t('finance:reports.export.pl')}
							disabled={!rangeReady}
							onClick={() =>
								downloadFile(
									`/reports/profit-and-loss.csv?startDate=${applied.startDate}&endDate=${applied.endDate}`,
									`profit-and-loss-${applied.startDate}_${applied.endDate}.csv`,
								)
							}
						/>
					}
				>
					{pl ? (
						<div className='space-y-4'>
							<ReportLines
								title={t('finance:reports.pl.revenue')}
								rows={pl.revenue}
								total={pl.totalRevenue}
							/>
							<ReportLines
								title={t('finance:reports.pl.expenses')}
								rows={pl.expenses}
								total={pl.totalExpenses}
							/>
							<div className='flex justify-between border-t pt-2 text-base font-semibold'>
								<span>{t('finance:reports.pl.netIncome')}</span>
								<span>{formatMoney(pl.netIncome)}</span>
							</div>
						</div>
					) : (
						<EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} />
					)}
				</ReportCard>

				<ReportCard
					title={t('finance:reports.tab.balanceSheet')}
					action={
						<ExportButton
							label={t('finance:reports.export.bs')}
							disabled={applied.asOfDate === ''}
							onClick={() =>
								downloadFile(
									`/reports/balance-sheet.csv?asOfDate=${applied.asOfDate}`,
									`balance-sheet-${applied.asOfDate}.csv`,
								)
							}
						/>
					}
				>
					{bs ? (
						<div className='space-y-4'>
							<ReportLines
								title={t('finance:reports.bs.assets')}
								rows={bs.assets}
								total={bs.totalAssets}
							/>
							<ReportLines
								title={t('finance:reports.bs.liabilities')}
								rows={bs.liabilities}
								total={bs.totalLiabilities}
							/>
							<ReportLines
								title={t('finance:reports.bs.equity')}
								rows={bs.equity}
								total={bs.totalEquity}
							/>
							{bs.unexplained !== 0 ? (
								<div className='flex justify-between border-t pt-2 text-sm font-medium text-destructive'>
									<span>{t('finance:reports.bs.unexplained')}</span>
									<span>{formatMoney(bs.unexplained)}</span>
								</div>
							) : null}
						</div>
					) : (
						<EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} />
					)}
				</ReportCard>

				<ReportCard
					title={t('finance:reports.tab.cashFlow')}
					action={
						<ExportButton
							label={t('finance:reports.export.cf')}
							disabled={!rangeReady}
							onClick={() =>
								downloadFile(
									`/reports/cash-flow.csv?startDate=${applied.startDate}&endDate=${applied.endDate}`,
									`cash-flow-${applied.startDate}_${applied.endDate}.csv`,
								)
							}
						/>
					}
				>
					{cf ? (
						<div className='space-y-4'>
							<ReportLines
								title={t('finance:reports.cf.operating')}
								rows={cf.operating}
								total={cf.netOperating}
							/>
							<ReportLines
								title={t('finance:reports.cf.investing')}
								rows={cf.investing}
								total={cf.netInvesting}
							/>
							<ReportLines
								title={t('finance:reports.cf.financing')}
								rows={cf.financing}
								total={cf.netFinancing}
							/>
							<div className='flex justify-between border-t pt-2 text-base font-semibold'>
								<span>{t('finance:reports.cf.netChange')}</span>
								<span>{formatMoney(cf.netChangeInCash)}</span>
							</div>
						</div>
					) : (
						<EmptyState icon={FileSpreadsheet} title={t('finance:reports.run')} />
					)}
				</ReportCard>
			</section>

			<section className='space-y-3'>
				<h2 className='text-lg font-semibold'>{t('finance:reports.group.ledger')}</h2>
				<TrialBalanceReport startDate={applied.startDate} endDate={applied.endDate} />
				<GeneralLedgerReport startDate={applied.startDate} endDate={applied.endDate} />
			</section>

			<section className='space-y-3'>
				<h2 className='text-lg font-semibold'>{t('finance:reports.group.management')}</h2>

				<ReportCard title={t('finance:reports.tab.pack')}>
					<ManagementPackReport />
				</ReportCard>

				<ReportCard title={t('finance:reports.tab.forecast')}>
					<CashForecastReport />
				</ReportCard>

				<ReportCard title={t('finance:reports.tab.statements')}>
					<StatementsReport startDate={applied.startDate} endDate={applied.endDate} />
				</ReportCard>

				<ReportCard title={t('finance:reports.tab.ratios')}>
					<RatiosReport startDate={applied.startDate} endDate={applied.endDate} />
				</ReportCard>

				<ReportCard title={t('finance:reports.tab.profitability')}>
					<ProfitabilityReport startDate={applied.startDate} endDate={applied.endDate} />
				</ReportCard>

				<ReportCard title={t('finance:reports.tab.projectCosting')}>
					<ProjectCostingReport startDate={applied.startDate} endDate={applied.endDate} />
				</ReportCard>

				<ReportCard title={t('finance:reports.tab.costCenters')}>
					<CostCenterPlReport startDate={applied.startDate} endDate={applied.endDate} />
				</ReportCard>
			</section>
		</div>
	);
}

/** One report section: a titled card, with an optional header action. */
function ReportCard({
	title,
	action,
	children,
}: {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{action ? <CardAction>{action}</CardAction> : null}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

/** A subtotal block inside a statement card (revenue, expenses, ...). */
function ReportLines({
	title,
	rows,
	total,
}: {
	title: string;
	rows: Array<{ code: string; name: string; amount: number }>;
	total: number;
}) {
	return (
		<div className='space-y-1'>
			<h3 className='text-sm font-medium'>{title}</h3>
			{rows.length === 0 ? (
				<p className='text-muted-foreground text-sm'>—</p>
			) : (
				<div className='space-y-1'>
					{rows.map((row) => (
						<div key={row.code} className='flex justify-between text-sm'>
							<span className='font-mono text-xs'>
								{row.code} — {row.name}
							</span>
							<span className='tabular-nums'>{formatMoney(row.amount)}</span>
						</div>
					))}
					<div className='flex justify-between border-t pt-1 text-sm font-medium'>
						<span>{title}</span>
						<span className='tabular-nums'>{formatMoney(total)}</span>
					</div>
				</div>
			)}
		</div>
	);
}

/** CSV export for one statement; hidden without the export permission. */
function ExportButton({
	label,
	disabled,
	onClick,
}: {
	label: string;
	disabled: boolean;
	onClick: () => Promise<void>;
}) {
	const canExport = usePermission('financial_report.export');
	if (!canExport) return null;
	return (
		<Button
			size='sm'
			variant='outline'
			disabled={disabled}
			onClick={() => void onClick()}
		>
			<Download className='size-4' data-icon='inline-start' />
			{label}
		</Button>
	);
}
