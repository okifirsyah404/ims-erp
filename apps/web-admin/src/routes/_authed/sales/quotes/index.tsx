import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	QUOTATION_STATUS_VARIANT,
	QUOTATION_STATUSES,
	quotationsQueryOptions,
	type TQuotationStatus,
} from '@/lib/quotation-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/sales/quotes` — quotations (SPH) visible to the caller (ADR-0011 step 3c). */
export const Route = createFileRoute('/_authed/sales/quotes/')({
	component: QuotationListPage,
});

function QuotationListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canCreate = usePermission('quotation.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TQuotationStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '';
	const { data, isPending, isError, error } = useQuery(
		quotationsQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: deferredSearch || undefined,
			status: status || undefined,
		}),
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('sales:quotations.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('sales:quotations.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/sales/quotes/new' />} nativeButton={false}>
						{t('sales:quotations.new')}
					</Button>
				)}
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('sales:quotations.search')}
					placeholder={t('sales:quotations.search')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
				<select
					aria-label={t('sales:quotation.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(e) => {
						setStatus(e.target.value as TQuotationStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('sales:quotations.allStatuses')}</option>
					{QUOTATION_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`sales:status.${value}`)}
						</option>
					))}
				</select>
			</div>

			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{filtered ? t('sales:quotations.noResults') : t('sales:quotations.empty')}
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('sales:quotation.code')}</TableHead>
										<TableHead>{t('sales:quotation.customer')}</TableHead>
										<TableHead>{t('sales:quotation.date')}</TableHead>
										<TableHead>{t('sales:quotation.status')}</TableHead>
										<TableHead className='text-right'>{t('sales:quotation.grandTotal')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((quotation) => (
										<TableRow key={quotation.id}>
											<TableCell>
												<Link
													to='/sales/quotes/$quotationId'
													params={{ quotationId: quotation.id }}
													className='font-medium hover:underline'
												>
													{quotation.code}
												</Link>
												<div className='text-xs text-muted-foreground'>{quotation.title}</div>
											</TableCell>
											<TableCell>{quotation.customerSnapshot.name}</TableCell>
											<TableCell className='text-muted-foreground'>
												{formatBusinessDate(quotation.quotationDate, i18n.language)}
											</TableCell>
											<TableCell>
												<div className='flex flex-wrap gap-1'>
													<Badge variant={QUOTATION_STATUS_VARIANT[quotation.status]}>
														{t(`sales:status.${quotation.status}`)}
													</Badge>
													{quotation.expired && <Badge variant='outline'>{t('sales:quotation.expired')}</Badge>}
												</div>
											</TableCell>
											<TableCell className='text-right'>{formatIdr(quotation.grandTotal)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls
							page={data.pagination.page}
							totalPages={data.pagination.totalPages}
							onPageChange={setPage}
						/>
					)}
				</>
			)}
		</div>
	);
}
