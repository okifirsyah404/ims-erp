import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { ContractBadges } from '@/components/licensing/contract-badges';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import { CONTRACT_STATUSES, contractsQueryOptions, DUE_WITHIN_DAYS, type TContractStatus } from '@/lib/license-api';
import { usePermission } from '@/lib/use-permission';

const searchSchema = z.object({ due: z.boolean().optional() });

/** `/subscription` — license contracts and the renewals due (M03 stage 1). */
export const Route = createFileRoute('/_authed/subscription/')({
	validateSearch: searchSchema,
	component: ContractListPage,
});

function ContractListPage() {
	const { t, i18n } = useTranslation(['licensing', 'common']);
	const canCreate = usePermission('license.create');
	const initial = Route.useSearch();
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TContractStatus | ''>('');
	const [dueOnly, setDueOnly] = useState(initial.due ?? false);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const { data, isPending, isError, error } = useQuery(
		contractsQueryOptions({
			page,
			search: deferredSearch || undefined,
			status: dueOnly ? undefined : status || undefined,
			dueWithinDays: dueOnly ? DUE_WITHIN_DAYS : undefined,
		}),
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('licensing:contracts.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('licensing:contracts.description')}</p>
				</div>
				{canCreate && (
					<Button render={<Link to='/subscription/new' />} nativeButton={false}>
						{t('licensing:contracts.new')}
					</Button>
				)}
			</div>
			<div className='flex flex-wrap items-center gap-3'>
				<select
					aria-label={t('licensing:field.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm disabled:opacity-50'
					value={status}
					disabled={dueOnly}
					onChange={(event) => {
						setStatus(event.target.value as TContractStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('licensing:contracts.allStatuses')}</option>
					{CONTRACT_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`licensing:status.${value}`)}
						</option>
					))}
				</select>
				<label className='flex items-center gap-2 text-sm'>
					<input
						type='checkbox'
						className='size-4'
						checked={dueOnly}
						onChange={(event) => {
							setDueOnly(event.target.checked);
							setPage(1);
						}}
					/>
					{t('licensing:contracts.dueOnly', { days: DUE_WITHIN_DAYS })}
				</label>
				<Input
					type='search'
					className='max-w-sm'
					aria-label={t('licensing:contracts.search')}
					placeholder={t('licensing:contracts.search')}
					value={search}
					onChange={(event) => {
						setSearch(event.target.value);
						setPage(1);
					}}
				/>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('licensing:contracts.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('licensing:field.code')}</TableHead>
										<TableHead>{t('licensing:field.customer')}</TableHead>
										<TableHead>{t('licensing:field.application')}</TableHead>
										<TableHead>{t('licensing:field.period')}</TableHead>
										<TableHead className='text-right'>{t('licensing:field.value')}</TableHead>
										<TableHead>{t('licensing:field.status')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((contract) => (
										<TableRow key={contract.id}>
											<TableCell>
												<Link to='/subscription/$contractId' params={{ contractId: contract.id }} className='font-medium hover:underline'>
													{contract.code}
												</Link>
											</TableCell>
											<TableCell>{contract.customerName}</TableCell>
											<TableCell>
												{contract.applicationName}
												{contract.packageName && <div className='text-xs text-muted-foreground'>{contract.packageName}</div>}
											</TableCell>
											<TableCell className='whitespace-nowrap'>
												{formatBusinessDate(contract.startDate, i18n.language)} –{' '}
												{contract.endDate ? formatBusinessDate(contract.endDate, i18n.language) : t('licensing:timing.perpetual')}
											</TableCell>
											<TableCell className='text-right whitespace-nowrap'>
												{formatIdr(contract.contractValue)}
												<div className='text-xs text-muted-foreground'>{t(`licensing:cycle.${contract.billingCycle}`)}</div>
											</TableCell>
											<TableCell>
												<ContractBadges contract={contract} />
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
