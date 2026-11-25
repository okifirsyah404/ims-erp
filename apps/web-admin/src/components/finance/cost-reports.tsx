import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { costCenterPlQueryOptions, projectCostingDetailQueryOptions, projectCostingQueryOptions } from '@/lib/finance-api';

const money = (minor: number | null) => (minor === null ? '—' : (minor / 100).toLocaleString('id-ID'));
const percent = (bps: number | null) => (bps === null ? '—' : `${(bps / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`);

/** Project job costing for a date range (ERP-0147): revenue, cost, margin, budget; a row expands to accounts. */
export function ProjectCostingReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance']);
	const enabled = startDate !== '' && startDate <= endDate;
	const report = useQuery({ ...projectCostingQueryOptions(startDate, endDate), enabled });
	const [open, setOpen] = useState<string | null>(null);
	if (!report.data) return null;
	if (report.data.rows.length === 0) return <p className='text-muted-foreground text-sm'>{t('finance:costReports.noProjects')}</p>;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t('finance:costReports.project')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.revenue')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.cost')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.margin')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.marginPct')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.budget')}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{report.data.rows.map((row) => (
					<Fragment key={row.projectId}>
						<TableRow>
							<TableCell>
								<Button size='sm' variant='link' className='h-auto p-0' onClick={() => setOpen(open === row.projectId ? null : row.projectId)}>
									<span className='font-mono text-xs'>{row.code ?? row.projectId.slice(0, 8)}</span>
								</Button>{' '}
								{row.title}
							</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.revenue)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(row.cost)}</TableCell>
							<TableCell className={`text-right tabular-nums ${row.margin < 0 ? 'text-destructive' : ''}`}>{money(row.margin)}</TableCell>
							<TableCell className='text-right tabular-nums'>{percent(row.marginBps)}</TableCell>
							<TableCell className={`text-right tabular-nums ${row.budget !== null && row.cost > row.budget ? 'text-destructive' : ''}`}>{money(row.budget)}</TableCell>
						</TableRow>
						{open === row.projectId ? <ProjectAccounts projectId={row.projectId} startDate={startDate} endDate={endDate} /> : null}
					</Fragment>
				))}
			</TableBody>
		</Table>
	);
}

function ProjectAccounts({ projectId, startDate, endDate }: { projectId: string; startDate: string; endDate: string }) {
	const detail = useQuery(projectCostingDetailQueryOptions(projectId, startDate, endDate));
	return (
		<>
			{(detail.data?.rows ?? []).map((row) => (
				<TableRow key={row.accountId} className='bg-muted/40 text-xs'>
					<TableCell className='pl-8'>
						{row.code} — {row.name}
					</TableCell>
					<TableCell className='text-right tabular-nums'>{row.accountType === 'revenue' ? money(row.amount) : ''}</TableCell>
					<TableCell className='text-right tabular-nums'>{row.accountType === 'expense' ? money(row.amount) : ''}</TableCell>
					<TableCell colSpan={3} />
				</TableRow>
			))}
		</>
	);
}

/** Revenue, cost and result per cost centre (ERP-0147). */
export function CostCenterPlReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance']);
	const enabled = startDate !== '' && startDate <= endDate;
	const report = useQuery({ ...costCenterPlQueryOptions(startDate, endDate), enabled });
	if (!report.data) return null;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t('finance:costReports.costCenter')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.revenue')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.cost')}</TableHead>
					<TableHead className='text-right'>{t('finance:costReports.result')}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{report.data.rows.map((row) => (
					<TableRow key={row.costCenterId ?? 'unassigned'}>
						<TableCell>{row.costCenterId ? `${row.code} — ${row.name}` : t('finance:costReports.unassigned')}</TableCell>
						<TableCell className='text-right tabular-nums'>{money(row.revenue)}</TableCell>
						<TableCell className='text-right tabular-nums'>{money(row.cost)}</TableCell>
						<TableCell className={`text-right tabular-nums ${row.result < 0 ? 'text-destructive' : ''}`}>{money(row.result)}</TableCell>
					</TableRow>
				))}
			</TableBody>
			<TableFooter>
				<TableRow>
					<TableCell>{t('finance:costReports.total')}</TableCell>
					<TableCell className='text-right tabular-nums'>{money(report.data.totals.revenue)}</TableCell>
					<TableCell className='text-right tabular-nums'>{money(report.data.totals.cost)}</TableCell>
					<TableCell className='text-right tabular-nums'>{money(report.data.totals.result)}</TableCell>
				</TableRow>
			</TableFooter>
		</Table>
	);
}
