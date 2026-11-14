import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Search } from 'lucide-react';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate } from '@/lib/format';
import { allBastsQueryOptions } from '@/lib/handover-api';

/** `/projects/bast` — BASTs of the projects visible to the caller. */
export const Route = createFileRoute('/_authed/projects/bast/')({
	component: BastListPage,
});

function BastListPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(allBastsQueryOptions({ page, search: deferredSearch || undefined }));

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('projects:bastList.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects:bastList.description')}</p>
			</div>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon align='inline-start'>
					<Search aria-hidden='true' />
				</InputGroupAddon>
				<InputGroupInput
					type='search'
					aria-label={t('projects:bastList.search')}
					placeholder={t('projects:bastList.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</InputGroup>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('projects:bast.none')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('projects:bast.number')}</TableHead>
										<TableHead>{t('projects:field.code')}</TableHead>
										<TableHead>{t('projects:bast.firstParty')}</TableHead>
										<TableHead>{t('projects:bast.date')}</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((bast) => (
										<TableRow key={bast.id}>
											<TableCell>
												<Link
													to='/projects/$projectId/bast/$bastId/print'
													params={{ projectId: bast.projectId, bastId: bast.id }}
													className='font-medium hover:underline'
												>
													{bast.code}
												</Link>
											</TableCell>
											<TableCell>
												<Link to='/projects/$projectId' params={{ projectId: bast.projectId }} className='hover:underline'>
													{bast.projectCode}
												</Link>
											</TableCell>
											<TableCell>
												<div>{bast.firstPartyCompany}</div>
												<div className='text-xs text-muted-foreground'>{bast.workTitle}</div>
											</TableCell>
											<TableCell className='text-muted-foreground'>{formatBusinessDate(bast.bastDate, i18n.language)}</TableCell>
											<TableCell>{bast.status === 'cancelled' && <Badge variant='outline'>{t('projects:bast.cancelled')}</Badge>}</TableCell>
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
