import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
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
import { formatBusinessDate, formatIdr, todayBusinessDate } from '@/lib/format';
import {
	INVOICE_STATUS_VARIANT,
	INVOICE_STATUSES,
	invoicesQueryOptions,
	isOverdue,
	type TInvoiceStatus,
	type TInvoiceTermKind,
} from '@/lib/invoice-api';

const PAGE_SIZE = 20;

/** Invoice list with search and filters; `termKind` narrows it (the DP menu). */
export function InvoiceList({ title, description, termKind }: { title: string; description: string; termKind?: TInvoiceTermKind }) {
	const { t, i18n } = useTranslation(['finance', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TInvoiceStatus | ''>('');
	const [overdue, setOverdue] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '' || overdue;
	const today = todayBusinessDate();
	const { data, isPending, isError, error } = useQuery(
		invoicesQueryOptions({
			page,
			limit: PAGE_SIZE,
			search: deferredSearch || undefined,
			status: status || undefined,
			termKind,
			overdue,
		}),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{title}</h1>
				<p className='text-sm text-muted-foreground'>{description}</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('finance:invoices.search')}
					placeholder={t('finance:invoices.search')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
				<select
					aria-label={t('finance:invoice.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(e) => {
						setStatus(e.target.value as TInvoiceStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('finance:invoices.allStatuses')}</option>
					{INVOICE_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`finance:status.${value}`)}
						</option>
					))}
				</select>
				<label className='flex items-center gap-2 text-sm'>
					<Checkbox
						checked={overdue}
						onCheckedChange={(checked) => {
							setOverdue(checked === true);
							setPage(1);
						}}
					/>
					{t('finance:invoices.overdueOnly')}
				</label>
			</div>

			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{filtered ? t('finance:invoices.noResults') : t('finance:invoices.empty')}
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('finance:invoice.code')}</TableHead>
										<TableHead>{t('finance:invoice.customer')}</TableHead>
										<TableHead>{t('finance:invoice.description')}</TableHead>
										<TableHead>{t('finance:invoice.dueDate')}</TableHead>
										<TableHead>{t('finance:invoice.status')}</TableHead>
										<TableHead className='text-right'>{t('finance:invoice.grandTotal')}</TableHead>
										<TableHead className='text-right'>{t('finance:invoice.outstanding')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((invoice) => (
										<TableRow key={invoice.id}>
											<TableCell>
												<Link
													to='/sales/invoices/$invoiceId'
													params={{ invoiceId: invoice.id }}
													className='font-medium hover:underline'
												>
													{invoice.code ?? t('finance:invoice.draftNumber')}
												</Link>
												<div className='text-xs text-muted-foreground'>{invoice.salesOrderCode}</div>
											</TableCell>
											<TableCell>{invoice.customerSnapshot.name}</TableCell>
											<TableCell>{invoice.description}</TableCell>
											<TableCell className='text-muted-foreground'>
												{formatBusinessDate(invoice.dueDate, i18n.language)}
											</TableCell>
											<TableCell>
												<div className='flex flex-wrap gap-1'>
													<Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
														{t(`finance:status.${invoice.status}`)}
													</Badge>
													{isOverdue(invoice, today) && <Badge variant='destructive'>{t('finance:invoice.overdue')}</Badge>}
												</div>
											</TableCell>
											<TableCell className='text-right'>{formatIdr(invoice.grandTotal)}</TableCell>
											<TableCell className='text-right'>{formatIdr(invoice.outstandingTotal)}</TableCell>
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
