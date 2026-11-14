import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	PR_STATUS_VARIANT,
	PURCHASE_REQUEST_STATUSES,
	purchaseRequestsQueryOptions,
	type TPurchaseRequestStatus,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/procurement/purchase-requests` — purchase requests, company-wide (M05). */
export const Route = createFileRoute('/_authed/procurement/purchase-requests/')({
	component: PurchaseRequestListPage,
});

function PurchaseRequestListPage() {
	const { t, i18n } = useTranslation(['procurement', 'common']);
	const canCreate = usePermission('purchase_request.create');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TPurchaseRequestStatus | ''>('');
	const [mine, setMine] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		purchaseRequestsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined, mine }),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:prs.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:prs.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/procurement/purchase-requests/new' />} nativeButton={false}>
						{t('procurement:prs.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('procurement:prs.search')}
					placeholder={t('procurement:prs.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
				<select
					aria-label={t('procurement:po.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as TPurchaseRequestStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('procurement:pos.allStatuses')}</option>
					{PURCHASE_REQUEST_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`procurement:prStatus.${value}`)}
						</option>
					))}
				</select>
				<label className='flex items-center gap-2 text-sm'>
					<input
						type='checkbox'
						checked={mine}
						onChange={(event) => {
							setMine(event.target.checked);
							setPage(1);
						}}
					/>
					{t('procurement:prs.mine')}
				</label>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('procurement:prs.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('procurement:pr.code')}</TableHead>
										<TableHead>{t('procurement:pr.requestedBy')}</TableHead>
										<TableHead>{t('procurement:pr.neededBy')}</TableHead>
										<TableHead>{t('procurement:po.status')}</TableHead>
										<TableHead className='text-right'>{t('procurement:pr.estimatedTotal')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((row) => (
										<TableRow key={row.id}>
											<TableCell>
												<Link
													to='/procurement/purchase-requests/$purchaseRequestId'
													params={{ purchaseRequestId: row.id }}
													className='font-medium hover:underline'
												>
													{row.code ?? t('procurement:pr.noNumber')}
												</Link>
												<div className='text-xs text-muted-foreground'>{row.subject}</div>
											</TableCell>
											<TableCell>{row.requestedByName ?? '—'}</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(row.neededBy, i18n.language)}</TableCell>
											<TableCell>
												<Badge variant={PR_STATUS_VARIANT[row.status]}>{t(`procurement:prStatus.${row.status}`)}</Badge>
											</TableCell>
											<TableCell className='text-right'>{formatIdr(row.estimatedTotal)}</TableCell>
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
