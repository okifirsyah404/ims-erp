import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { PROFITABILITY_DIMENSIONS, profitabilityQueryOptions, type TProfitabilityDimension } from '@/lib/finance-api';

const money = (minor: number) => (minor / 100).toLocaleString('id-ID');
const percent = (bps: number | null) => (bps === null ? '—' : `${(bps / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`);

/** Revenue, cost and margin by project, customer, product or business line (ERP-0150). */
export function ProfitabilityReport({ startDate, endDate }: { startDate: string; endDate: string }) {
	const { t } = useTranslation(['finance']);
	const [dimension, setDimension] = useState<TProfitabilityDimension>('business_line');
	const enabled = startDate !== '' && startDate <= endDate;
	const report = useQuery({ ...profitabilityQueryOptions(startDate, endDate, dimension), enabled });
	return (
		<div className='space-y-3'>
			<Select value={dimension} onValueChange={(value: string | null) => value && setDimension(value as TProfitabilityDimension)}>
				<SelectTrigger className='w-56'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{PROFITABILITY_DIMENSIONS.map((value) => (
						<SelectItem key={value} value={value}>
							{t(`finance:profitability.dimension.${value}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{report.data ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t(`finance:profitability.dimension.${dimension}`)}</TableHead>
							<TableHead className='text-right'>{t('finance:costReports.revenue')}</TableHead>
							<TableHead className='text-right'>{t('finance:costReports.cost')}</TableHead>
							<TableHead className='text-right'>{t('finance:costReports.margin')}</TableHead>
							<TableHead className='text-right'>{t('finance:costReports.marginPct')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{report.data.rows.map((row) => (
							<TableRow key={row.key ?? 'unassigned'}>
								<TableCell>{row.label ?? t('finance:profitability.unassigned')}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.revenue)}</TableCell>
								<TableCell className='text-right tabular-nums'>{money(row.cost)}</TableCell>
								<TableCell className={`text-right tabular-nums ${row.margin < 0 ? 'text-destructive' : ''}`}>{money(row.margin)}</TableCell>
								<TableCell className='text-right tabular-nums'>{percent(row.marginBps)}</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell>{t('finance:costReports.total')}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(report.data.totals.revenue)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(report.data.totals.cost)}</TableCell>
							<TableCell className='text-right tabular-nums'>{money(report.data.totals.margin)}</TableCell>
							<TableCell />
						</TableRow>
					</TableFooter>
				</Table>
			) : null}
			<p className='text-muted-foreground text-xs'>{t('finance:profitability.hint')}</p>
		</div>
	);
}
