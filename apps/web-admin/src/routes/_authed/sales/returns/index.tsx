import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
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
	SALES_RETURN_STATUSES,
	salesReturnsQueryOptions,
	SALES_RETURN_STATUS_VARIANT,
	type TSalesReturnStatus,
} from '@/lib/sales-return-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/sales/returns` — goods sent back to suppliers (ERP-0062). */
export const Route = createFileRoute('/_authed/sales/returns/')({
	component: SalesReturnListPage,
});

function SalesReturnListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canCreate = usePermission('purchase_return.create');
	const canSeeCost = usePermission('product.read_cost');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TSalesReturnStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		salesReturnsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('sales:returns.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('sales:returns.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/sales/returns/new' />} nativeButton={false}>
						{t('sales:returns.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-3'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('sales:returns.search')}
						placeholder={t('sales:returns.search')}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === 'all' || value == null ? '' : (value as TSalesReturnStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('sales:return.status')} className='w-48'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('sales:returns.allStatuses')}</SelectItem>
						{SALES_RETURN_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`sales:returnStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('sales:returns.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('sales:return.code')}</TableHead>
										<TableHead>{t('sales:delivery.code')}</TableHead>
										<TableHead>{t('sales:return.customer')}</TableHead>
										<TableHead>{t('sales:return.date')}</TableHead>
										<TableHead>{t('sales:return.status')}</TableHead>
										{canSeeCost && <TableHead className='text-right'>{t('sales:return.total')}</TableHead>}
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell>
												<Link
													to='/sales/returns/$salesReturnId'
													params={{ salesReturnId: row.id }}
													className='font-medium hover:underline'
												>
													{row.code ?? t('sales:return.noNumber')}
												</Link>
												<div className='text-xs text-muted-foreground'>{row.reason}</div>
											</TableCell>
											<TableCell>{row.deliveryNoteCode}</TableCell>
											<TableCell>{row.customerName}</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(row.returnDate, i18n.language)}</TableCell>
											<TableCell>
												<Badge variant={SALES_RETURN_STATUS_VARIANT[row.status]}>{t(`sales:returnStatus.${row.status}`)}</Badge>
											</TableCell>
											{canSeeCost && <TableCell className='text-right'>{formatIdr(row.totalAmount)}</TableCell>}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
		</div>
	);
}
