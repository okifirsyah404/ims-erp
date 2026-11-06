import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Badge } from '@ims-erp/ui/components/badge';
import { CircleAlert, Download, ReceiptText } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import {
	recapCsvUrl,
	recapQueryOptions,
	recapXlsxUrl,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/tax` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/');

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Known filing statuses, mirroring the backend state machine. */
const FILING_STATUSES = ['draft', 'verified', 'filed', 'corrected'] as const;
type TFilingStatus = (typeof FILING_STATUSES)[number];

const asFilingStatus = (status: string): TFilingStatus =>
	(FILING_STATUSES as readonly string[]).includes(status)
		? (status as TFilingStatus)
		: 'draft';

const statusTone = (status: TFilingStatus) =>
	status === 'filed' ? 'default' : status === 'draft' ? 'outline' : 'secondary';

/**
 * Period recap (ERP-0016): net payable per tax type, corrections included,
 * with the phase-2 CSV export. Column layout is a finance gate (D12).
 */
export function TaxRecap() {
	const { t } = useTranslation(['tax', 'common']);
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const canExport = usePermission('tax.export');

	const now = new Date();
	const [year, setYear] = useState(search.year ?? now.getFullYear());
	const [month, setMonth] = useState(search.month ?? now.getMonth() + 1);

	const { data, isPending, isError, error } = useQuery({
		...recapQueryOptions(year, month),
		placeholderData: (previous) => previous,
	});

	const applyPeriod = () => {
		void navigate({ search: { year, month } });
	};

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('tax:recap.title')}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('tax:recap.description')}
				</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<input
					type='number'
					className='h-9 w-24 rounded-md border bg-transparent px-3 text-sm'
					value={year}
					min={2000}
					max={2100}
					onChange={(event) => setYear(Number(event.target.value))}
					aria-label={t('tax:recap.year')}
				/>
				<select
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={month}
					onChange={(event) => setMonth(Number(event.target.value))}
					aria-label={t('tax:recap.month')}
				>
					{MONTHS.map((value) => (
						<option key={value} value={value}>
							{value}
						</option>
					))}
				</select>
				<Button variant='outline' onClick={applyPeriod}>
					{t('tax:period.apply')}
				</Button>
				{canExport ? (
					<Button
						variant='outline'
						onClick={() => {
							window.location.href = recapCsvUrl(year, month);
						}}
					>
						<Download className='size-4' data-icon='inline-start' />
						{t('tax:recap.exportCsv')}
					</Button>
				) : null}
				{canExport ? (
					<Button
						variant='outline'
						onClick={() => {
							window.location.href = recapXlsxUrl(year, month);
						}}
					>
						<Download className='size-4' data-icon='inline-start' />
						{t('tax:recap.exportXlsx')}
					</Button>
				) : null}
			</div>

			{isError ? (
				<EmptyState
					icon={CircleAlert}
					title={t('tax:recap.title')}
					description={error.message}
				/>
			) : isPending ? null : !data ||
				data.lines.length === 0 ? (
				<EmptyState
					icon={ReceiptText}
					title={t('tax:recap.title')}
					description={t('tax:recap.empty')}
				/>
			) : (
				<>
					<div className='overflow-hidden rounded-lg border'>
						<table className='w-full text-sm'>
							<thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
								<tr>
									<th className='px-3 py-2'>{t('tax:recap.column.code')}</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:recap.column.taxableBase')}
									</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:recap.column.taxAmount')}
									</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:recap.column.correctionTotal')}
									</th>
									<th className='px-3 py-2 text-right'>
										{t('tax:recap.column.netPayable')}
									</th>
									<th className='px-3 py-2'>
										{t('tax:recap.column.filingStatus')}
									</th>
								</tr>
							</thead>
							<tbody>
								{data.lines.map((line) => (
									<tr key={line.taxRecordId} className='border-t'>
										<td className='px-3 py-2 font-mono text-xs'>{line.code}</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(line.taxableBase / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(line.taxAmount / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(line.correctionTotal / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2 text-right font-mono text-xs'>
											{(line.netPayable / 100).toLocaleString()}
										</td>
										<td className='px-3 py-2'>
											<Badge variant={statusTone(asFilingStatus(line.filingStatus))}>
												{t(`tax:status.${asFilingStatus(line.filingStatus)}`)}
											</Badge>
										</td>
									</tr>
								))}
							</tbody>
							<tfoot>
								<tr className='border-t bg-muted/30 font-medium'>
									<td className='px-3 py-2'>{t('tax:recap.totalNetPayable')}</td>
									<td colSpan={3} />
									<td className='px-3 py-2 text-right font-mono text-xs'>
										{(data.totalNetPayable / 100).toLocaleString()}
									</td>
									<td />
								</tr>
							</tfoot>
						</table>
					</div>
				</>
			)}
		</div>
	);
}
