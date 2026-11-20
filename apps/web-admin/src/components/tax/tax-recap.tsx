import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Input } from '@ims-erp/ui/components/input';
import { Badge } from '@ims-erp/ui/components/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { CircleAlert, Download, ReceiptText } from 'lucide-react';
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';

import { EmptyState } from '@/components/empty-state';
import {
	recapCsvUrl,
	recapQueryOptions,
	recapXlsxUrl,
} from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** The route API for `/finance/tax/recap` (validated search params). */
const routeApi = getRouteApi('/_authed/finance/tax/recap/');

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Default period = current month, computed once at module load. */
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

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

	const [year, setYear] = useState(search.year ?? CURRENT_YEAR);
	const [month, setMonth] = useState(search.month ?? CURRENT_MONTH);

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
				<Input
					type='number'
					className='w-24'
					value={year}
					min={2000}
					max={2100}
					onChange={(event) => setYear(Number(event.target.value))}
					aria-label={t('tax:recap.year')}
				/>
				<Select
					value={String(month)}
					onValueChange={(value: string | null) => setMonth(Number(value ?? 1))}
				>
					<SelectTrigger aria-label={t('tax:recap.month')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{MONTHS.map((value) => (
							<SelectItem key={value} value={String(value)}>
								{value}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
					<div className='overflow-hidden rounded-md border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('tax:recap.column.code')}</TableHead>
									<TableHead className='text-right'>
										{t('tax:recap.column.taxableBase')}
									</TableHead>
									<TableHead className='text-right'>
										{t('tax:recap.column.taxAmount')}
									</TableHead>
									<TableHead className='text-right'>
										{t('tax:recap.column.correctionTotal')}
									</TableHead>
									<TableHead className='text-right'>
										{t('tax:recap.column.netPayable')}
									</TableHead>
									<TableHead>
										{t('tax:recap.column.filingStatus')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.lines.map((line) => (
									<TableRow key={line.taxRecordId}>
										<TableCell className='font-mono text-xs'>{line.code}</TableCell>
										<TableCell className='text-right font-mono text-xs'>
											{(line.taxableBase / 100).toLocaleString()}
										</TableCell>
										<TableCell className='text-right font-mono text-xs'>
											{(line.taxAmount / 100).toLocaleString()}
										</TableCell>
										<TableCell className='text-right font-mono text-xs'>
											{(line.correctionTotal / 100).toLocaleString()}
										</TableCell>
										<TableCell className='text-right font-mono text-xs'>
											{(line.netPayable / 100).toLocaleString()}
										</TableCell>
										<TableCell>
											<Badge variant={statusTone(asFilingStatus(line.filingStatus))}>
												{t(`tax:status.${asFilingStatus(line.filingStatus)}`)}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow className='font-medium'>
									<TableCell>{t('tax:recap.totalNetPayable')}</TableCell>
									<TableCell colSpan={3} />
									<TableCell className='text-right font-mono text-xs'>
										{(data.totalNetPayable / 100).toLocaleString()}
									</TableCell>
									<TableCell />
								</TableRow>
							</TableFooter>
						</Table>
					</div>
				</>
			)}
		</div>
	);
}
