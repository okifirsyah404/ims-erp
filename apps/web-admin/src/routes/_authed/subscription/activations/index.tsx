import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@ims-erp/ui/components/card';
import { EventTable } from '@/components/licensing/event-table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { eventsQueryOptions, GRACE_DAYS } from '@/lib/license-api';

/** `/subscription/activations` — validation and activation log of the license API (M03 stage 2). */
export const Route = createFileRoute('/_authed/subscription/activations/')({
	component: ActivationLogPage,
});

function ActivationLogPage() {
	const { t } = useTranslation(['licensing', 'common']);
	const [page, setPage] = useState(1);
	const { data, isPending, isError, error } = useQuery(eventsQueryOptions({ page }));

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('licensing:events.pageTitle')}</h1>
				<p className='text-sm text-muted-foreground'>{t('licensing:events.pageDescription', { days: GRACE_DAYS })}</p>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('licensing:events.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<EventTable events={data.rows} showContract />
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
