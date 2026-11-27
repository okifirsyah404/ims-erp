import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import { downloadFile } from '@/lib/download';
import { managementPackQueryOptions } from '@/lib/finance-api';

const money = (minor: number) => (minor / 100).toLocaleString('id-ID');
const ratio = (value: number | null, percent = false) =>
	value === null ? '—' : percent ? `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : value.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/**
 * Monthly management pack (ERP-0152): headline figures, ratios, profitability
 * by business line and project budget vs actual for one month. Excel comes
 * from the server; PDF is the browser print of this tab.
 */
export function ManagementPackReport() {
	const { t } = useTranslation(['finance']);
	const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
	const valid = /^\d{4}-\d{2}$/.test(month);
	const [year, monthNumber] = valid ? (month.split('-').map(Number) as [number, number]) : [0, 0];
	const query = useQuery({ ...managementPackQueryOptions(year, monthNumber), enabled: valid });
	const pack = query.data;

	const headline: Array<[string, number]> = pack
		? [
				[t('finance:pack.revenue'), pack.profitAndLoss.totalRevenue],
				[t('finance:pack.expenses'), pack.profitAndLoss.totalExpenses],
				[t('finance:pack.netIncome'), pack.profitAndLoss.netIncome],
				[t('finance:pack.totalAssets'), pack.balanceSheet.totalAssets],
				[t('finance:pack.totalLiabilities'), pack.balanceSheet.totalLiabilities],
				[t('finance:pack.totalEquity'), pack.balanceSheet.totalEquity],
				[t('finance:pack.netChangeInCash'), pack.cashFlow.netChange],
				[t('finance:pack.closingCash'), pack.cashFlow.closingCash],
			]
		: [];
	const ratios: Array<[string, string]> = pack
		? [
				[t('finance:ratios.current'), ratio(pack.ratios.liquidity.current)],
				[t('finance:ratios.quick'), ratio(pack.ratios.liquidity.quick)],
				[t('finance:ratios.grossMargin'), ratio(pack.ratios.profitability.grossMargin, true)],
				[t('finance:ratios.netMargin'), ratio(pack.ratios.profitability.netMargin, true)],
				[t('finance:ratios.der'), ratio(pack.ratios.leverage.debtToEquity)],
				[t('finance:ratios.dso'), ratio(pack.ratios.efficiency.dso)],
			]
		: [];

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center gap-2 print:hidden'>
				<Input type='month' className='w-44' value={month} onChange={(event) => setMonth(event.target.value)} aria-label={t('finance:pack.month')} />
				<Button
					size='sm'
					variant='outline'
					disabled={!valid}
					onClick={() =>
						void downloadFile(`/finance/reports/management-pack.xlsx?year=${year}&month=${monthNumber}`, `management-pack-${month}.xlsx`).catch((error: Error) =>
							toast.error(error.message),
						)
					}
				>
					<Download className='size-4' />
					{t('finance:pack.excel')}
				</Button>
				<Button size='sm' variant='outline' disabled={!pack} onClick={() => window.print()}>
					<Printer className='size-4' />
					{t('finance:pack.print')}
				</Button>
			</div>

			{pack ? (
				<div className='space-y-6'>
					<div>
						<h2 className='text-lg font-semibold'>{t('finance:pack.title', { period: month })}</h2>
						<p className='text-muted-foreground text-xs'>
							{pack.periodStatus === null || pack.periodStatus === 'open' ? t('finance:pack.draft') : t('finance:pack.final', { status: pack.periodStatus })}
						</p>
					</div>

					<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
						{headline.map(([label, value]) => (
							<Card key={label} size='sm' className='gap-0 py-3'>
								<CardContent>
									<p className='text-muted-foreground text-xs'>{label}</p>
									<p className='text-lg font-semibold tabular-nums'>{money(value)}</p>
								</CardContent>
							</Card>
						))}
					</div>

					<div>
						<h3 className='mb-2 font-medium'>{t('finance:reports.tab.ratios')}</h3>
						<div className='grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6'>
							{ratios.map(([label, value]) => (
								<Card key={label} size='sm' className='gap-0 py-2'>
									<CardContent>
										<p className='text-muted-foreground text-xs'>{label}</p>
										<p className='font-medium tabular-nums'>{value}</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>

					<div>
						<h3 className='mb-2 font-medium'>{t('finance:pack.profitability')}</h3>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('finance:pack.businessLine')}</TableHead>
									<TableHead className='text-right'>{t('finance:pack.revenue')}</TableHead>
									<TableHead className='text-right'>{t('finance:pack.cost')}</TableHead>
									<TableHead className='text-right'>{t('finance:pack.margin')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{pack.profitability.rows.map((row) => (
									<TableRow key={row.key ?? 'none'}>
										<TableCell>{row.label ?? t('finance:pack.unattributed')}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(row.revenue)}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(row.cost)}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(row.margin)}</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell>{t('finance:pack.total')}</TableCell>
									<TableCell className='text-right tabular-nums'>{money(pack.profitability.totals.revenue)}</TableCell>
									<TableCell className='text-right tabular-nums'>{money(pack.profitability.totals.cost)}</TableCell>
									<TableCell className='text-right tabular-nums'>{money(pack.profitability.totals.margin)}</TableCell>
								</TableRow>
							</TableFooter>
						</Table>
					</div>

					<div>
						<h3 className='mb-2 font-medium'>{t('finance:pack.budgetVsActual')}</h3>
						{pack.budgetVsActual.rows.length === 0 ? (
							<p className='text-muted-foreground text-sm'>{t('finance:pack.noBudgets')}</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('finance:pack.project')}</TableHead>
										<TableHead className='text-right'>{t('finance:pack.budget')}</TableHead>
										<TableHead className='text-right'>{t('finance:pack.actual')}</TableHead>
										<TableHead className='text-right'>{t('finance:pack.variance')}</TableHead>
										<TableHead className='text-right'>{t('finance:pack.budgetToDate')}</TableHead>
										<TableHead className='text-right'>{t('finance:pack.actualToDate')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{pack.budgetVsActual.rows.map((row) => (
										<TableRow key={row.projectId}>
											<TableCell>{[row.code, row.title].filter(Boolean).join(' — ') || row.projectId}</TableCell>
											<TableCell className='text-right tabular-nums'>{money(row.budget)}</TableCell>
											<TableCell className='text-right tabular-nums'>{money(row.actual)}</TableCell>
											<TableCell className={`text-right tabular-nums ${row.variance < 0 ? 'text-destructive' : ''}`}>{money(row.variance)}</TableCell>
											<TableCell className='text-right tabular-nums'>{money(row.budgetToDate)}</TableCell>
											<TableCell className='text-right tabular-nums'>{money(row.actualToDate)}</TableCell>
										</TableRow>
									))}
								</TableBody>
								<TableFooter>
									<TableRow>
										<TableCell>{t('finance:pack.total')}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(pack.budgetVsActual.totals.budget)}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(pack.budgetVsActual.totals.actual)}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(pack.budgetVsActual.totals.variance)}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(pack.budgetVsActual.totals.budgetToDate)}</TableCell>
										<TableCell className='text-right tabular-nums'>{money(pack.budgetVsActual.totals.actualToDate)}</TableCell>
									</TableRow>
								</TableFooter>
							</Table>
						)}
					</div>
					<p className='text-muted-foreground text-xs'>{t('finance:pack.hint')}</p>
				</div>
			) : null}
		</div>
	);
}
