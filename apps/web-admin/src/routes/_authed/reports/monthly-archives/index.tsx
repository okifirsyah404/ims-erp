import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { EmptyState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import {
	type TReportArchive,
	archiveMonth,
	reportArchivesQueryOptions,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

export const Route = createFileRoute('/_authed/reports/monthly-archives/')({
	component: MonthlyArchivesPage,
});

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

/** Current business month, so the form opens on the month just closed. */
const lastMonth = () => {
	const now = new Date();
	const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
	return {
		year: previous.getUTCFullYear(),
		month: previous.getUTCMonth() + 1,
	};
};

/**
 * `/reports/monthly-archives` - frozen statements per closed month (M12 T30,
 * SOP S13).
 *
 * @remarks
 * Archiving is a POST that the server gates on `accounting_period:close` and
 * on the period being closed; a repeat call for the same month creates
 * nothing, which the toast reports instead of hiding.
 */
function MonthlyArchivesPage() {
	const { t } = useTranslation(['finance', 'common']);
	const canRead = usePermission('financial_report.read');
	const canArchive = usePermission('accounting_period.close');
	const queryClient = useQueryClient();

	const [page, setPage] = useState(1);
	const initial = lastMonth();
	const [year, setYear] = useState(String(initial.year));
	const [month, setMonth] = useState(String(initial.month));

	const { data, isLoading } = useQuery({
		...reportArchivesQueryOptions({ page, limit: 20 }),
		enabled: canRead,
	});

	const archive = useMutation({
		mutationFn: () =>
			archiveMonth(Number(year), Number(month)),
		onSuccess: (rows) => {
			void queryClient.invalidateQueries({ queryKey: ['report-archives'] });
			toast.success(
				rows.length === 0
					? t('finance:archives.noneCreated')
					: t('finance:archives.archived', {
							count: rows.length,
							period: `${year}-${String(month).padStart(2, '0')}`,
						}),
			);		},
		onError: (error: Error) => toast.error(error.message),
	});

	if (!canRead) {
		return (
			<EmptyState icon={Archive} title={t('finance:archives.title')} bordered />
		);
	}

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold'>{t('finance:archives.title')}</h1>
				<p className='text-muted-foreground text-sm'>
					{t('finance:archives.description')}
				</p>
			</div>

			{canArchive ? (
				<Card>
					<CardHeader>
						<CardTitle>
							{t('finance:archives.archive')}
						</CardTitle>
					</CardHeader>
					<CardContent className='flex flex-wrap items-end gap-2'>
						<label className='text-sm'>
							<span className='text-muted-foreground block text-xs'>
								{t('finance:archives.year')}
							</span>
							<Input
								className='w-24'
								inputMode='numeric'
								value={year}
								onChange={(event) => setYear(event.target.value)}
							/>
						</label>
						<label className='text-sm'>
							<span className='text-muted-foreground block text-xs'>
								{t('finance:archives.month')}
							</span>
							<Input
								className='w-20'
								inputMode='numeric'
								value={month}
								onChange={(event) => setMonth(event.target.value)}
							/>
						</label>
						<Button
							size='sm'
							disabled={archive.isPending}
							onClick={() => archive.mutate()}
						>
							{t('finance:archives.archive')}
						</Button>
					</CardContent>
				</Card>
			) : null}

			{isLoading ? (
				<SectionSkeleton lines={4} />
			) : rows.length === 0 ? (
				<EmptyState icon={Archive} title={t('finance:archives.empty')} bordered />
			) : (
				<div className='space-y-2'>
					{rows.map((row) => (
						<ArchiveRow key={row.id} row={row} />
					))}
				</div>
			)}

			{pagination && pagination.totalPages > 1 ? (
				<div className='flex items-center justify-between'>
					<Button
						size='sm'
						variant='outline'
						disabled={page <= 1}
						onClick={() => setPage((current) => current - 1)}
					>
						{t('common:action.previous')}
					</Button>
					<span className='text-muted-foreground text-sm'>
						{page} / {pagination.totalPages}
					</span>
					<Button
						size='sm'
						variant='outline'
						disabled={page >= pagination.totalPages}
						onClick={() => setPage((current) => current + 1)}
					>
						{t('common:action.next')}
					</Button>
				</div>
			) : null}
		</div>
	);
}

/** One archived statement: the headline figure for its type, plus metadata. */
function ArchiveRow({ row }: { row: TReportArchive }) {
	const { t } = useTranslation('finance');
	/** Literal keys so the locale dead-key guard sees them. */
	const TYPE_LABEL = {
		profit_and_loss: 'type.profit_and_loss',
		balance_sheet: 'type.balance_sheet',
		cash_flow: 'type.cash_flow',
	} as const;
	const headline = (() => {
		if (row.reportType === 'profit_and_loss') {
			return {
				label: t('archives.netIncome'),
				value: (row.payload as { netIncome: number }).netIncome,
			};
		}
		if (row.reportType === 'balance_sheet') {
			return {
				label: t('archives.totalAssets'),
				value: (row.payload as { totalAssets: number }).totalAssets,
			};
		}
		return {
			label: t('archives.netChangeInCash'),
			value: (row.payload as { netChangeInCash: number }).netChangeInCash,
		};
	})();

	return (
		<Card>
			<CardContent className='flex flex-wrap items-center justify-between gap-3 py-3'>
				<div className='flex items-center gap-3'>
					<Badge variant='secondary'>
						{row.periodYear}-{String(row.periodMonth).padStart(2, '0')}
					</Badge>
					<span className='text-sm font-medium'>
						{t(TYPE_LABEL[row.reportType])}
					</span>
					<span className='text-muted-foreground text-xs'>
						{t('archives.generatedAt')}{' '}
						{new Date(row.generatedAt).toLocaleString()}
					</span>
				</div>
				<div className='text-sm'>
					<span className='text-muted-foreground'>{headline.label}: </span>
					<span className='font-mono'>{formatMoney(headline.value)}</span>
				</div>
			</CardContent>
		</Card>
	);
}
