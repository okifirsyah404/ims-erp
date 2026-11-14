import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@ims-erp/ui/components/input-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
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
	SALES_ORDER_STATUS_VARIANT,
	SALES_ORDER_STATUSES,
	salesOrdersQueryOptions,
	type TSalesOrderStatus,
} from '@/lib/sales-order-api';

const PAGE_SIZE = 20;

/** `/sales/orders` — sales orders visible to the caller (ADR-0011 step 3d). */
export const Route = createFileRoute('/_authed/sales/orders/')({
	component: SalesOrderListPage,
});

function SalesOrderListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TSalesOrderStatus | ''>('');
	const deferredSearch = useDeferredValue(search.trim());
	const filtered = deferredSearch !== '' || status !== '';
	const { data, isPending, isError, error } = useQuery(
		salesOrdersQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined }),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('sales:orders.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('sales:orders.description')}</p>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('sales:orders.search')}
						placeholder={t('sales:orders.search')}
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
						setStatus(value === 'all' || value == null ? '' : (value as TSalesOrderStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('sales:quotation.status')} className='w-44'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('sales:quotations.allStatuses')}</SelectItem>
						{SALES_ORDER_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`sales:orderStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{filtered ? t('sales:orders.noResults') : t('sales:orders.empty')}
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('sales:order.code')}</TableHead>
										<TableHead>{t('sales:quotation.customer')}</TableHead>
										<TableHead>{t('sales:order.date')}</TableHead>
										<TableHead>{t('sales:quotation.status')}</TableHead>
										<TableHead className='text-right'>{t('sales:quotation.grandTotal')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((order) => (
										<TableRow key={order.id}>
											<TableCell>
												<Link
													to='/sales/orders/$orderId'
													params={{ orderId: order.id }}
													className='font-medium hover:underline'
												>
													{order.code}
												</Link>
												<div className='text-xs text-muted-foreground'>
													{[order.quotationCode, order.customerPoNumber].filter(Boolean).join(' · ')}
												</div>
											</TableCell>
											<TableCell>{order.customerSnapshot.name}</TableCell>
											<TableCell className='text-muted-foreground'>
												{formatBusinessDate(order.orderDate, i18n.language)}
											</TableCell>
											<TableCell>
												<Badge variant={SALES_ORDER_STATUS_VARIANT[order.status]}>
													{t(`sales:orderStatus.${order.status}`)}
												</Badge>
											</TableCell>
											<TableCell className='text-right'>{formatIdr(order.grandTotal)}</TableCell>
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
