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
import { DELIVERY_NOTE_STATUS_VARIANT, deliveryNotesQueryOptions } from '@/lib/delivery-note-api';
import { formatBusinessDate } from '@/lib/format';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** `/sales/deliveries` — delivery notes / surat jalan (ADR-0011 step 5a). */
export const Route = createFileRoute('/_authed/sales/deliveries/')({
	component: DeliveryNoteListPage,
});

function DeliveryNoteListPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const canIssue = usePermission('stock.issue');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		deliveryNotesQueryOptions({ page, limit: PAGE_SIZE, search: deferredSearch || undefined }),
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('sales:deliveries.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('sales:deliveries.description')}</p>
				</div>
				{canIssue && (
					<Button render={<Link to='/sales/deliveries/new' />} nativeButton={false}>
						{t('sales:deliveries.new')}
					</Button>
				)}
			</div>
			<Input
				type='search'
				className='max-w-sm'
				aria-label={t('sales:deliveries.search')}
				placeholder={t('sales:deliveries.search')}
				value={search}
				onChange={(e) => {
					setSearch(e.target.value);
					setPage(1);
				}}
			/>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('sales:deliveries.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('sales:delivery.code')}</TableHead>
										<TableHead>{t('sales:delivery.order')}</TableHead>
										<TableHead>{t('sales:delivery.recipientName')}</TableHead>
										<TableHead>{t('sales:delivery.date')}</TableHead>
										<TableHead>{t('sales:delivery.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((note) => (
										<TableRow key={note.id}>
											<TableCell>
												<Link
													to='/sales/deliveries/$deliveryNoteId'
													params={{ deliveryNoteId: note.id }}
													className='font-medium hover:underline'
												>
													{note.code}
												</Link>
											</TableCell>
											<TableCell>{note.salesOrderCode}</TableCell>
											<TableCell>
												<div>{note.recipientName}</div>
												{note.projectName && <div className='text-xs text-muted-foreground'>{note.projectName}</div>}
											</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(note.deliveryDate, i18n.language)}</TableCell>
											<TableCell>
												<Badge variant={DELIVERY_NOTE_STATUS_VARIANT[note.status]}>{t(`sales:deliveryStatus.${note.status}`)}</Badge>
											</TableCell>
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
