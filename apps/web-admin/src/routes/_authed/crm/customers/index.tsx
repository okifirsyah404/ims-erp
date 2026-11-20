import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState } from '@/components/empty-state';
import { CompanyFormDialog } from '@/components/crm/company-form-dialog';
import { CustomerFormDialog } from '@/components/crm/customer-form-dialog';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	CUSTOMER_STATUSES,
	companiesQueryOptions,
	createCompany,
	createCustomer,
	customersQueryOptions,
	type TCompany,
	type TCompanyInput,
	type TCustomer,
	type TCustomerInput,
	type TCustomerStatus,
} from '@/lib/customer-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

type TTab = 'companies' | 'people';

/** `/crm/customers` - company-wide customer companies and people (ADR-0024). */
export const Route = createFileRoute('/_authed/crm/customers/')({
	component: CustomerListPage,
});

function CustomerListPage() {
	const { t } = useTranslation(['crm', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('customer.create');
	const [tab, setTab] = useState<TTab>('companies');
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TCustomerStatus | ''>('');
	const [creating, setCreating] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const deferredSearch = useDeferredValue(search.trim());
	const params = { page, limit: PAGE_SIZE, search: deferredSearch || undefined, status: status || undefined };
	const companies = useQuery({ ...companiesQueryOptions(params), enabled: tab === 'companies' });
	const people = useQuery({ ...customersQueryOptions(params), enabled: tab === 'people' });
	const active = tab === 'companies' ? companies : people;
	const filtered = deferredSearch !== '' || status !== '';

	const companyColumns = useMemo<ColumnDef<DataTableFeatures, TCompany, CellData>[]>(
		() => [
			{ accessorKey: 'code', header: t('crm:customer.code'), meta: { cellClassName: 'font-mono text-xs' } },
			{
				id: 'name',
				header: t('crm:customer.name'),
				cell: ({ row }) => (
					<Link
						to='/crm/customers/$customerId'
						params={{ customerId: row.original.id }}
						search={{ kind: 'company' }}
						className='font-medium hover:underline'
					>
						{row.original.name}
					</Link>
				),
			},
			{
				id: 'type',
				header: t('crm:customer.customerType'),
				cell: ({ row }) => t(`crm:customerType.${row.original.companyType}`),
			},
			{
				id: 'phone',
				header: t('crm:customer.phone'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.phone ?? row.original.whatsapp ?? '-',
			},
			{
				id: 'status',
				header: t('crm:customer.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.status === 'active' ? 'secondary' : 'outline'}>
						{t(`crm:customerStatus.${row.original.status}`)}
					</Badge>
				),
			},
		],
		[t],
	);

	const personColumns = useMemo<ColumnDef<DataTableFeatures, TCustomer, CellData>[]>(
		() => [
			{ accessorKey: 'code', header: t('crm:customer.code'), meta: { cellClassName: 'font-mono text-xs' } },
			{
				id: 'name',
				header: t('crm:customer.name'),
				cell: ({ row }) => (
					<Link
						to='/crm/customers/$customerId'
						params={{ customerId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.name}
					</Link>
				),
			},
			{
				id: 'type',
				header: t('crm:customer.customerType'),
				cell: ({ row }) => t(`crm:customerType.${row.original.customerType}`),
			},
			{
				id: 'phone',
				header: t('crm:customer.phone'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.phone ?? row.original.whatsapp ?? '-',
			},
			{
				id: 'status',
				header: t('crm:customer.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.status === 'active' ? 'secondary' : 'outline'}>
						{t(`crm:customerStatus.${row.original.status}`)}
					</Badge>
				),
			},
		],
		[t],
	);

	function switchTab(next: TTab) {
		setTab(next);
		setPage(1);
	}

	async function handleCreate(work: () => Promise<{ id: string }>, kind: TTab) {
		setSubmitting(true);
		try {
			const created = await work();
			await queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
			toast.success(t('crm:customers.saved'));
			void navigate({
				to: '/crm/customers/$customerId',
				params: { customerId: created.id },
				search: kind === 'companies' ? { kind: 'company' } : {},
			});
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('crm:customers.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('crm:customers.description')}</p>
				</div>
				{canCreate && (
					<Button onClick={() => setCreating(true)}>
						{tab === 'companies' ? t('crm:customers.newCompany') : t('crm:customers.new')}
					</Button>
				)}
			</div>

			<div className='flex flex-wrap gap-2'>
				<Button variant={tab === 'companies' ? 'default' : 'outline'} onClick={() => switchTab('companies')}>
					{t('crm:customers.tab.companies')}
				</Button>
				<Button variant={tab === 'people' ? 'default' : 'outline'} onClick={() => switchTab('people')}>
					{t('crm:customers.tab.people')}
				</Button>
			</div>

			<div className='flex flex-wrap gap-2'>
				<InputGroup className='max-w-xs'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('crm:customers.search')}
						placeholder={t('crm:customers.search')}
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
				</InputGroup>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TCustomerStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('crm:customer.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('crm:customers.filterAll')}</SelectItem>
						{CUSTOMER_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`crm:customerStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{active.isPending ? null : active.isError ? (
				<p className='text-sm text-destructive'>{active.error.message}</p>
			) : (active.data?.rows.length ?? 0) === 0 ? (
				<EmptyState title={filtered ? t('crm:customers.noResults') : t('crm:customers.empty')} bordered />
			) : (
				<>
					{tab === 'companies' ? (
						<DataTable
							columns={companyColumns}
							data={companies.data?.rows ?? []}
							getRowId={(row) => row.id}
							bordered
						/>
					) : (
						<DataTable
							columns={personColumns}
							data={people.data?.rows ?? []}
							getRowId={(row) => row.id}
							bordered
						/>
					)}
					{active.data && active.data.pagination.totalPages > 1 && (
						<PaginationControls
							page={active.data.pagination.page}
							totalPages={active.data.pagination.totalPages}
							onPageChange={setPage}
						/>
					)}
				</>
			)}

			{creating && tab === 'companies' && (
				<CompanyFormDialog
					company={null}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input: TCompanyInput) => void handleCreate(() => createCompany(input), 'companies')}
				/>
			)}
			{creating && tab === 'people' && (
				<CustomerFormDialog
					customer={null}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input: TCustomerInput) => void handleCreate(() => createCustomer(input), 'people')}
				/>
			)}
		</div>
	);
}
