import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ims-erp/ui/components/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { ServerSortHeader, type TServerSort } from '@/components/data-table/server-sort-header';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { CompanyCombobox } from '@/components/crm/company-combobox';
import { CompanyFormDialog } from '@/components/crm/company-form-dialog';
import { CustomerCredentialsDialog } from '@/components/crm/customer-credentials-dialog';
import { CustomerAvatar, CustomerFormDialog } from '@/components/crm/customer-form-dialog';
import { useCustomerSave } from '@/components/crm/use-customer-save';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	COMPANY_TYPES,
	CUSTOMER_STATUSES,
	CUSTOMER_TYPES,
	companiesQueryOptions,
	createCompany,
	customersQueryOptions,
	type TCompany,
	type TCompanyInput,
	type TCompanyType,
	type TCustomer,
	type TCustomerRef,
	type TCustomerSort,
	type TCustomerStatus,
	type TCustomerType,
} from '@/lib/customer-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZES = [10, 20, 50, 100] as const;
const ALL = 'all';

type TTab = 'companies' | 'people';

/** `/crm/customers` - company-wide customer companies and people (ADR-0024, ERP-0114). */
export const Route = createFileRoute('/_authed/crm/customers/')({
	component: CustomerListPage,
});

/**
 * Customer list: two server-paginated TanStack tables (companies, people)
 * with server-side sort, dropdown filters and a page-size choice. People show
 * their account photo and company; a create opens the one-time credentials
 * dialog (ERP-0114).
 */
function CustomerListPage() {
	const { t } = useTranslation(['crm', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('customer.create');
	const [tab, setTab] = useState<TTab>('people');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<number>(20);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<TCustomerStatus | ''>('');
	const [personType, setPersonType] = useState<TCustomerType | ''>('');
	const [companyType, setCompanyType] = useState<TCompanyType | ''>('');
	const [companyFilter, setCompanyFilter] = useState<TCustomerRef | null>(null);
	const [sort, setSort] = useState<TServerSort<TCustomerSort>>({ key: 'name', order: 'asc' });
	const [creating, setCreating] = useState(false);
	const [companySubmitting, setCompanySubmitting] = useState(false);
	const people = useCustomerSave();
	const deferredSearch = useDeferredValue(search.trim());

	const common = {
		page,
		limit: pageSize,
		search: deferredSearch || undefined,
		status: status || undefined,
		sort: sort.key,
		order: sort.order,
	};
	const companies = useQuery({
		...companiesQueryOptions({ ...common, companyType: companyType || undefined }),
		enabled: tab === 'companies',
	});
	const persons = useQuery({
		...customersQueryOptions({
			...common,
			customerType: personType || undefined,
			companyId: companyFilter?.id,
		}),
		enabled: tab === 'people',
	});
	const active = tab === 'companies' ? companies : persons;
	const filtered =
		deferredSearch !== '' ||
		status !== '' ||
		(tab === 'people' ? personType !== '' || companyFilter !== null : companyType !== '');

	/** Any filter or sort change starts again at page 1. */
	function reset<T>(setter: (value: T) => void) {
		return (value: T) => {
			setter(value);
			setPage(1);
		};
	}
	const onSort = reset(setSort);
	const sortHeader = (title: string, key: TCustomerSort) => () => (
		<ServerSortHeader title={title} sortKey={key} sort={sort} onSortChange={onSort} />
	);

	const statusCell = (value: TCustomerStatus) => (
		<Badge variant={value === 'active' ? 'secondary' : 'outline'}>{t(`crm:customerStatus.${value}`)}</Badge>
	);

	// Rebuilt each render: the headers close over the current sort.
	const companyColumns: ColumnDef<DataTableFeatures, TCompany, CellData>[] = [
			{
				id: 'code',
				header: sortHeader(t('crm:customer.code'), 'code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.code,
			},
			{
				id: 'name',
				header: sortHeader(t('crm:customer.name'), 'name'),
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
				id: 'owner',
				header: t('crm:customer.owner'),
				cell: ({ row }) =>
					row.original.owner ? (
						<Link
							to='/crm/customers/$customerId'
							params={{ customerId: row.original.owner.id }}
							className='hover:underline'
						>
							{row.original.owner.name}
						</Link>
					) : (
						<span className='text-muted-foreground'>-</span>
					),
			},
			{
				id: 'phone',
				header: t('crm:customer.phone'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.phone ?? '-',
			},
			{
				id: 'status',
				header: sortHeader(t('crm:customer.status'), 'status'),
				cell: ({ row }) => statusCell(row.original.status),
			},
	];

	// Rebuilt each render: the headers close over the current sort.
	const personColumns: ColumnDef<DataTableFeatures, TCustomer, CellData>[] = [
			{
				id: 'name',
				header: sortHeader(t('crm:customer.name'), 'name'),
				cell: ({ row }) => (
					<div className='flex items-center gap-3'>
						<CustomerAvatar name={row.original.name} image={row.original.account?.image} className='size-8' />
						<div className='min-w-0'>
							<Link
								to='/crm/customers/$customerId'
								params={{ customerId: row.original.id }}
								className='block truncate font-medium hover:underline'
							>
								{row.original.name}
							</Link>
							<span className='block truncate text-xs text-muted-foreground'>
								{row.original.account?.email ?? row.original.code}
							</span>
						</div>
					</div>
				),
			},
			{
				id: 'code',
				header: sortHeader(t('crm:customer.code'), 'code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.code,
			},
			{
				id: 'company',
				header: t('crm:customer.company'),
				cell: ({ row }) =>
					row.original.company ? (
						<span className='flex flex-wrap items-center gap-1.5'>
							<Link
								to='/crm/customers/$customerId'
								params={{ customerId: row.original.company.id }}
								search={{ kind: 'company' }}
								className='hover:underline'
							>
								{row.original.company.name}
							</Link>
							{row.original.isOwner && <Badge variant='outline'>{t('crm:customer.ownerBadge')}</Badge>}
						</span>
					) : (
						<span className='text-muted-foreground'>-</span>
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
				cell: ({ row }) => row.original.phone ?? '-',
			},
			{
				id: 'status',
				header: sortHeader(t('crm:customer.status'), 'status'),
				cell: ({ row }) => statusCell(row.original.status),
			},
			{
				id: 'createdAt',
				header: sortHeader(t('crm:customer.createdAt'), 'createdAt'),
				meta: { cellClassName: 'text-muted-foreground whitespace-nowrap' },
				cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
			},
	];

	function switchTab(next: TTab) {
		setTab(next);
		setPage(1);
	}

	async function handleCreateCompany(input: TCompanyInput) {
		setCompanySubmitting(true);
		try {
			const created = await createCompany(input);
			await queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
			toast.success(t('crm:customers.saved'));
			void navigate({ to: '/crm/customers/$customerId', params: { customerId: created.id }, search: { kind: 'company' } });
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setCompanySubmitting(false);
		}
	}

	const pagination = active.data?.pagination;

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
				<Button variant={tab === 'people' ? 'default' : 'outline'} onClick={() => switchTab('people')}>
					{t('crm:customers.tab.people')}
				</Button>
				<Button variant={tab === 'companies' ? 'default' : 'outline'} onClick={() => switchTab('companies')}>
					{t('crm:customers.tab.companies')}
				</Button>
			</div>

			<div className='flex flex-wrap gap-2'>
				<InputGroup className='w-full sm:max-w-xs'>
					<InputGroupAddon align='inline-start'>
						<Search aria-hidden='true' />
					</InputGroupAddon>
					<InputGroupInput
						type='search'
						aria-label={t('crm:customers.search')}
						placeholder={t('crm:customers.search')}
						value={search}
						onChange={(event) => reset(setSearch)(event.target.value)}
					/>
				</InputGroup>
				<Select
					value={status || ALL}
					onValueChange={(value: string | null) =>
						reset(setStatus)(value === null || value === ALL ? '' : (value as TCustomerStatus))
					}
				>
					<SelectTrigger aria-label={t('crm:customer.status')}>
						<SelectValue>
							{(value: string) =>
								value === ALL ? t('crm:customers.filterAll') : t(`crm:customerStatus.${value as TCustomerStatus}`)
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>{t('crm:customers.filterAll')}</SelectItem>
						{CUSTOMER_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`crm:customerStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{tab === 'people' ? (
					<>
						<Select
							value={personType || ALL}
							onValueChange={(value: string | null) =>
								reset(setPersonType)(value === null || value === ALL ? '' : (value as TCustomerType))
							}
						>
							<SelectTrigger aria-label={t('crm:customer.customerType')}>
								<SelectValue>
									{(value: string) =>
										value === ALL ? t('crm:customers.filterAllTypes') : t(`crm:customerType.${value as TCustomerType}`)
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL}>{t('crm:customers.filterAllTypes')}</SelectItem>
								{CUSTOMER_TYPES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`crm:customerType.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className='w-full sm:w-64'>
							<CompanyCombobox
								value={companyFilter}
								onChange={reset(setCompanyFilter)}
								placeholder={t('crm:customers.filterAllCompanies')}
								emptyText={t('crm:customer.companyEmpty')}
								ariaLabel={t('crm:customer.company')}
								clearable
							/>
						</div>
					</>
				) : (
					<Select
						value={companyType || ALL}
						onValueChange={(value: string | null) =>
							reset(setCompanyType)(value === null || value === ALL ? '' : (value as TCompanyType))
						}
					>
						<SelectTrigger aria-label={t('crm:customer.customerType')}>
							<SelectValue>
								{(value: string) =>
									value === ALL ? t('crm:customers.filterAllTypes') : t(`crm:customerType.${value as TCompanyType}`)
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>{t('crm:customers.filterAllTypes')}</SelectItem>
							{COMPANY_TYPES.map((value) => (
								<SelectItem key={value} value={value}>
									{t(`crm:customerType.${value}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>

			<DataTableCard>
				{active.isError ? (
					<ErrorState error={active.error} />
				) : !active.isPending && (active.data?.rows.length ?? 0) === 0 ? (
					<EmptyState title={filtered ? t('crm:customers.noResults') : t('crm:customers.empty')} />
				) : (
					<>
						{tab === 'companies' ? (
							<DataTable
								columns={companyColumns}
								data={companies.data?.rows ?? []}
								getRowId={(row) => row.id}
								loading={companies.isPending}
							/>
						) : (
							<DataTable
								columns={personColumns}
								data={persons.data?.rows ?? []}
								getRowId={(row) => row.id}
								loading={persons.isPending}
							/>
						)}
						<div className='flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3'>
							<div className='flex items-center gap-2 text-sm text-muted-foreground'>
								<span>{t('crm:customers.pageSize')}</span>
								<Select
									value={String(pageSize)}
									onValueChange={(value: string | null) => reset(setPageSize)(Number(value ?? 20))}
								>
									<SelectTrigger aria-label={t('crm:customers.pageSize')} className='w-20'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAGE_SIZES.map((size) => (
											<SelectItem key={size} value={String(size)}>
												{size}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{pagination && pagination.totalPages > 1 && (
								<PaginationControls
									page={pagination.page}
									totalPages={pagination.totalPages}
									onPageChange={setPage}
								/>
							)}
						</div>
					</>
				)}
			</DataTableCard>

			{creating && tab === 'companies' && (
				<CompanyFormDialog
					company={null}
					submitting={companySubmitting}
					onClose={() => setCreating(false)}
					onSave={(input) => void handleCreateCompany(input)}
				/>
			)}
			{creating && tab === 'people' && (
				<CustomerFormDialog
					customer={null}
					submitting={people.submitting}
					onClose={() => setCreating(false)}
					onSave={(input, photo) =>
						void people.save(null, input, photo).then((saved) => {
							if (saved) setCreating(false);
						})
					}
				/>
			)}
			{people.created && (
				<CustomerCredentialsDialog
					name={people.created.name}
					email={people.created.email}
					credentials={people.created.credentials}
					onClose={people.clearCreated}
				/>
			)}
		</div>
	);
}
