import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { ContractBadges } from '@/components/licensing/contract-badges';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	CONTRACT_STATUSES,
	contractsQueryOptions,
	DUE_WITHIN_DAYS,
	type TContractStatus,
	type TLicenseContract,
} from '@/lib/license-api';
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

	const columns = useMemo<ColumnDef<DataTableFeatures, TLicenseContract, CellData>[]>(
		() => [
			{
				id: 'code',
				header: t('licensing:field.code'),
				cell: ({ row }) => (
					<Link
						to='/subscription/$contractId'
						params={{ contractId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.code}
					</Link>
				),
			},
			{ accessorKey: 'customerName', header: t('licensing:field.customer') },
			{
				id: 'application',
				header: t('licensing:field.application'),
				cell: ({ row }) => (
					<>
						{row.original.applicationName}
						{row.original.packageName && (
							<div className='text-xs text-muted-foreground'>{row.original.packageName}</div>
						)}
					</>
				),
			},
			{
				id: 'period',
				header: t('licensing:field.period'),
				meta: { cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => (
					<>
						{formatBusinessDate(row.original.startDate, i18n.language)} –{' '}
						{row.original.endDate
							? formatBusinessDate(row.original.endDate, i18n.language)
							: t('licensing:timing.perpetual')}
					</>
				),
			},
			{
				id: 'value',
				header: t('licensing:field.value'),
				meta: { align: 'right', cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => (
					<>
						{formatIdr(row.original.contractValue)}
						<div className='text-xs text-muted-foreground'>
							{t(`licensing:cycle.${row.original.billingCycle}`)}
						</div>
					</>
				),
			},
			{
				id: 'status',
				header: t('licensing:field.status'),
				cell: ({ row }) => <ContractBadges contract={row.original} />,
			},
		],
		[i18n.language, t],
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
				<Select
					value={status || 'all'}
					disabled={dueOnly}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TContractStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('licensing:field.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('licensing:contracts.allStatuses')}</SelectItem>
						{CONTRACT_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`licensing:status.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Field orientation='horizontal' className='w-auto'>
					<Checkbox
						id='contracts-due-only'
						checked={dueOnly}
						onCheckedChange={(checked) => {
							setDueOnly(checked === true);
							setPage(1);
						}}
					/>
					<FieldLabel htmlFor='contracts-due-only'>
						{t('licensing:contracts.dueOnly', { days: DUE_WITHIN_DAYS })}
					</FieldLabel>
				</Field>
				<InputGroup className='max-w-sm'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('licensing:contracts.search')}
						placeholder={t('licensing:contracts.search')}
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState title={t('licensing:contracts.empty')} />
				) : (
					<>
						<DataTable columns={columns} data={data?.rows ?? []} loading={isPending} getRowId={(row) => row.id} />
						{data && data.pagination.totalPages > 1 && (
							<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
						)}
					</>
				)}
			</DataTableCard>
		</div>
	);
}
