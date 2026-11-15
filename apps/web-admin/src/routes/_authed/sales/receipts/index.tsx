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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import { receiptsQueryOptions } from '@/lib/invoice-api';

const PAGE_SIZE = 20;

/** `/sales/receipts` — receipts (kwitansi) with their invoice (ADR-0011 step 3d-2). */
export const Route = createFileRoute('/_authed/sales/receipts/')({
	component: ReceiptsPage,
});

function ReceiptsPage() {
	const { t, i18n } = useTranslation(['finance', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		receiptsQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined }),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('finance:receipts.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('finance:receipts.description')}</p>
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('finance:receipts.search')}
					placeholder={t('finance:receipts.search')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
			</InputGroup>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{deferredSearch ? t('finance:receipts.noResults') : t('finance:receipt.empty')}
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('finance:receipt.code')}</TableHead>
										<TableHead>{t('finance:invoice.code')}</TableHead>
										<TableHead>{t('finance:invoice.customer')}</TableHead>
										<TableHead>{t('finance:receipt.date')}</TableHead>
										<TableHead>{t('finance:receipt.method')}</TableHead>
										<TableHead className='text-right'>{t('finance:receipt.amount')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((receipt) => (
										<TableRow key={receipt.id}>
											<TableCell>
												<div className='flex flex-wrap items-center gap-2'>
													{receipt.code}
													{receipt.status === 'reversed' && (
														<Badge variant='outline'>{t('finance:receipt.reversedBadge')}</Badge>
													)}
												</div>
											</TableCell>
											<TableCell>
												<Link
													to='/sales/invoices/$invoiceId'
													params={{ invoiceId: receipt.invoiceId }}
													className='hover:underline'
												>
													{receipt.invoiceCode ?? '—'}
												</Link>
											</TableCell>
											<TableCell>{receipt.customerName}</TableCell>
											<TableCell className='text-muted-foreground'>
												{formatBusinessDate(receipt.receivedDate, i18n.language)}
											</TableCell>
											<TableCell>{t(`finance:method.${receipt.method}`)}</TableCell>
											<TableCell className='text-right'>{formatIdr(receipt.amount)}</TableCell>
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
