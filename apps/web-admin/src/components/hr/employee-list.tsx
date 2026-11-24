import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Funnel, IdCard, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@ims-erp/ui/components/avatar';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@ims-erp/ui/components/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { useConfirm } from '@/components/confirm-dialog';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { EmployeeCreateDialog } from '@/components/hr/employee-create-dialog';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	archiveEmployee,
	EMPLOYMENT_STATUSES,
	EMPLOYMENT_TYPES,
	employeesQueryOptions,
	GENDERS,
	MARITAL_STATUSES,
	type TEmployee,
	type TEmployeeSortField,
	type TEmploymentStatus,
	WORK_TYPES,
} from '@/lib/hr-api';
import { usePermission } from '@/lib/use-permission';
import type { TEmployeesSearch } from '@/routes/_authed/hr/employees/index';

const routeApi = getRouteApi('/_authed/hr/employees/');

/** Rows per page. */
const PAGE_SIZE = 20;

/** Badge tone per employment status. */
const STATUS_TONE: Record<TEmploymentStatus, 'default' | 'secondary' | 'destructive'> = {
	active: 'default',
	inactive: 'secondary',
	terminated: 'destructive',
};

/** The filters of the popover; search, page and sort live outside it. */
type TFilters = Pick<TEmployeesSearch, 'status' | 'employmentType' | 'workType' | 'gender' | 'maritalStatus' | 'scope' | 'login'>;
const FILTER_KEYS = ['status', 'employmentType', 'workType', 'gender', 'maritalStatus', 'scope', 'login'] as const;

/**
 * The employee table (`/hr/employees`): the `/admin/users` pattern — URL-backed
 * search, a Filters popover (employment status, employment type, work type,
 * gender, marital status, organization vs company level, login account),
 * server-side sort headers, server pagination and row actions. No
 * organization picker: the list is the caller's organization plus
 * company-level staff (ERP-0034 scope).
 */
export function EmployeeList() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const navigate = routeApi.useNavigate();
	const queryClient = useQueryClient();
	const search = routeApi.useSearch();
	const [searchDraft, setSearchDraft] = useState(search.search ?? '');
	const canCreate = usePermission('employee.create');
	const canUpdate = usePermission('employee.update');
	const canArchive = usePermission('employee.archive');
	const confirm = useConfirm();
	/** The invite-first create dialog (replaces the former `/hr/employees/new` page). */
	const [creating, setCreating] = useState(false);

	const sortBy = search.sortBy ?? 'fullName';
	const sortDir = search.sortDir ?? 'asc';

	const { data, isPending, isError, error } = useQuery({
		...employeesQueryOptions({
			page: search.page ?? 1,
			limit: PAGE_SIZE,
			search: search.search,
			status: search.status,
			employmentType: search.employmentType,
			workType: search.workType,
			gender: search.gender,
			maritalStatus: search.maritalStatus,
			scope: search.scope,
			login: search.login,
			sortBy,
			sortDir,
		}),
		placeholderData: (previous) => previous,
	});

	const archive = useMutation({
		mutationFn: (id: string) => archiveEmployee(id),
		onSuccess: () => {
			toast.success(t('hr:list.archived'));
			void queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TEmployee, CellData>[]>(() => {
		/** Server-driven sort header: the URL holds the sort, not the table. */
		const sortHeader = (label: string, field: TEmployeeSortField) => () => {
			const active = sortBy === field;
			const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
			return (
				<Button
					variant='ghost'
					size='sm'
					className='-ml-2 h-8'
					onClick={() =>
						void navigate({
							search: (prev) => ({
								...prev,
								page: 1,
								sortBy: field,
								sortDir: active ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc',
							}),
						})
					}
				>
					{label}
					<Icon className='ml-1 size-3' aria-hidden='true' />
				</Button>
			);
		};
		return [
			{
				id: 'employee',
				header: sortHeader(t('hr:list.employee'), 'fullName'),
				cell: ({ row }) => <EmployeeIdentity employee={row.original} />,
			},
			{
				id: 'employeeCode',
				header: sortHeader(t('hr:form.employeeCode'), 'employeeCode'),
				meta: { cellClassName: 'font-mono text-xs whitespace-nowrap' },
				cell: ({ row }) => row.original.employeeCode,
			},
			{
				id: 'status',
				header: t('hr:field.status'),
				cell: ({ row }) => (
					<div className='flex flex-wrap gap-1'>
						<Badge variant={STATUS_TONE[row.original.employmentStatus]}>{t(`hr:status.${row.original.employmentStatus}`)}</Badge>
						{!row.original.userId && <Badge variant='outline'>{t('hr:list.noLogin')}</Badge>}
					</div>
				),
			},
			{
				id: 'employment',
				header: t('hr:list.employment'),
				cell: ({ row }) => (
					<div className='text-sm'>
						<div>{t(`hr:employmentType.${row.original.employmentType}`)}</div>
						<div className='text-xs text-muted-foreground'>{t(`hr:workType.${row.original.workType}`)}</div>
					</div>
				),
			},
			{
				id: 'scope',
				header: t('hr:list.scope'),
				cell: ({ row }) =>
					row.original.organizationId === null ? (
						<Badge variant='outline'>{t('hr:list.companyLevel')}</Badge>
					) : (
						<span className='text-xs text-muted-foreground'>{t('hr:list.organizationLevel')}</span>
					),
			},
			{
				id: 'hireDate',
				header: sortHeader(t('hr:form.hireDate'), 'hireDate'),
				meta: { cellClassName: 'text-xs text-muted-foreground whitespace-nowrap' },
				cell: ({ row }) => (row.original.hireDate ? new Date(row.original.hireDate).toLocaleDateString(i18n.language) : '—'),
			},
			{
				id: 'createdAt',
				header: sortHeader(t('hr:list.created'), 'createdAt'),
				meta: { cellClassName: 'text-xs text-muted-foreground whitespace-nowrap' },
				cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(i18n.language),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('hr:list.actions')}</span>,
				meta: { align: 'right' },
				// The row itself opens the detail page; the menu must not.
				cell: ({ row }) => (
					<div onClick={(event) => event.stopPropagation()}>
						<RowActions
							label={t('hr:list.actions')}
							disabled={archive.isPending}
							actions={[
								{
									key: 'edit',
									label: t('hr:detail.edit'),
									icon: Pencil,
									hidden: !canUpdate,
									onSelect: () => void navigate({ to: '/hr/employees/$employeeId/edit', params: { employeeId: row.original.id } }),
								},
								{
									key: 'archive',
									label: t('hr:list.archive'),
									icon: Archive,
									destructive: true,
									hidden: !canArchive,
									onSelect: async () => {
										if (
											await confirm({
												title: t('hr:list.archiveConfirm', { name: row.original.fullName }),
												description: t('hr:list.archiveConfirmDescription'),
												confirmLabel: t('hr:list.archive'),
												destructive: true,
											})
										) {
											archive.mutate(row.original.id);
										}
									},
								},
							]}
						/>
					</div>
				),
			},
		];
	}, [archive, canArchive, canUpdate, confirm, i18n.language, navigate, sortBy, sortDir, t]);

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='flex items-center gap-2 text-2xl font-bold'>
						<IdCard className='size-6' />
						{t('hr:list.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:list.description')}</p>
				</div>
				{canCreate && (
					<Button className='shrink-0' onClick={() => setCreating(true)}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('hr:list.new')}
					</Button>
				)}
			</div>

			{/* Search + filters ----------------------------------------------- */}
			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('hr:list.search')}</span>
					<Input
						className='w-64'
						placeholder={t('hr:list.searchPlaceholder')}
						value={searchDraft}
						onChange={(event) => setSearchDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								void navigate({ search: (prev) => ({ ...prev, page: 1, search: searchDraft || undefined }) });
							}
						}}
					/>
				</div>
				<FiltersPopover
					filters={Object.fromEntries(FILTER_KEYS.map((key) => [key, search[key]])) as TFilters}
					onApply={(filters) => void navigate({ search: (prev) => ({ ...prev, ...filters, page: 1 }) })}
					onReset={() => {
						setSearchDraft('');
						void navigate({ search: {} });
					}}
				/>
			</div>

			{/* Table ------------------------------------------------------------- */}
			<Card>
				<CardHeader>
					<CardTitle>{t('hr:list.tableTitle')}</CardTitle>
					<CardDescription>
						{pagination ? (
							t('hr:list.count', { total: pagination.total })
						) : isPending ? (
							<Skeleton className='h-4 w-20 motion-reduce:animate-none' />
						) : null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isError && <ErrorState error={error} size='sm' />}
					{!isPending && !isError && rows.length === 0 && <EmptyState title={t('hr:list.emptyTitle')} size='sm' />}
					{(isPending || rows.length > 0) && (
						<DataTable
							columns={columns}
							data={rows}
							getRowId={(employee) => employee.id}
							loading={isPending}
							onRowClick={(employee) => void navigate({ to: '/hr/employees/$employeeId', params: { employeeId: employee.id } })}
						/>
					)}
					{pagination && pagination.totalPages > 1 && (
						<PaginationControls
							page={pagination.page}
							totalPages={pagination.totalPages}
							onPageChange={(next) => void navigate({ search: (prev) => ({ ...prev, page: next }) })}
						/>
					)}
				</CardContent>
			</Card>

			{creating && <EmployeeCreateDialog onClose={() => setCreating(false)} />}
		</div>
	);
}

/** Avatar + name + email + login handle. The whole row opens the detail page. */
function EmployeeIdentity({ employee }: { employee: TEmployee }) {
	const initials = employee.fullName
		.split(' ')
		.map((part) => part[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();
	return (
		<div className='flex items-center gap-3'>
			<Avatar className='size-9'>
				{employee.login?.image && <AvatarImage src={employee.login.image} alt={employee.fullName} />}
				<AvatarFallback>{initials || '—'}</AvatarFallback>
			</Avatar>
			<div className='flex min-w-0 flex-col'>
				<span className='font-medium'>{employee.fullName}</span>
				{employee.email && <span className='truncate text-xs text-muted-foreground'>{employee.email}</span>}
				{employee.login?.username && <span className='text-xs text-muted-foreground'>@{employee.login.username}</span>}
			</div>
		</div>
	);
}

/** One select of the popover: "all" clears the filter. */
function FilterSelect<T extends string>({
	label,
	allLabel,
	value,
	options,
	onChange,
}: {
	label: string;
	allLabel: string;
	value: T | undefined;
	options: readonly { value: T; label: string }[];
	onChange: (value: T | undefined) => void;
}) {
	return (
		<div className='flex flex-col gap-1'>
			<span className='text-xs text-muted-foreground'>{label}</span>
			<Select value={value ?? 'all'} onValueChange={(next: string | null) => onChange(next === 'all' || next == null ? undefined : (next as T))}>
				<SelectTrigger className='w-full'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='all'>{allLabel}</SelectItem>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/** The Filters popover (drafts applied on "Apply", like `/admin/users`). */
function FiltersPopover({ filters, onApply, onReset }: { filters: TFilters; onApply: (filters: TFilters) => void; onReset: () => void }) {
	const { t } = useTranslation(['hr', 'common']);
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<TFilters>(filters);
	const activeCount = FILTER_KEYS.filter((key) => filters[key] !== undefined).length;
	const all = t('hr:list.filterAll');
	const set = (patch: Partial<TFilters>) => setDraft((current) => ({ ...current, ...patch }));

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				// Re-seed the drafts from the URL whenever the popover opens.
				if (next) setDraft(filters);
				setOpen(next);
			}}
		>
			<PopoverTrigger
				render={
					<Button variant={activeCount > 0 ? 'default' : 'outline'}>
						<Funnel className='mr-2 size-4' />
						{t('hr:list.filters')}
						{activeCount > 0 && (
							<Badge variant='secondary' className='ml-2'>
								{t('hr:list.activeFilters', { total: activeCount })}
							</Badge>
						)}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-80'>
				<PopoverHeader>
					<PopoverTitle>{t('hr:list.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='grid grid-cols-2 gap-3'>
					<FilterSelect
						label={t('hr:field.status')}
						allLabel={all}
						value={draft.status}
						options={EMPLOYMENT_STATUSES.map((value) => ({ value, label: t(`hr:status.${value}`) }))}
						onChange={(status) => set({ status })}
					/>
					<FilterSelect
						label={t('hr:form.employmentType')}
						allLabel={all}
						value={draft.employmentType}
						options={EMPLOYMENT_TYPES.map((value) => ({ value, label: t(`hr:employmentType.${value}`) }))}
						onChange={(employmentType) => set({ employmentType })}
					/>
					<FilterSelect
						label={t('hr:form.workType')}
						allLabel={all}
						value={draft.workType}
						options={WORK_TYPES.map((value) => ({ value, label: t(`hr:workType.${value}`) }))}
						onChange={(workType) => set({ workType })}
					/>
					<FilterSelect
						label={t('hr:account.gender')}
						allLabel={all}
						value={draft.gender}
						options={GENDERS.map((value) => ({ value, label: t(`hr:account.genderOption.${value}`) }))}
						onChange={(gender) => set({ gender })}
					/>
					<FilterSelect
						label={t('hr:account.maritalStatus')}
						allLabel={all}
						value={draft.maritalStatus}
						options={MARITAL_STATUSES.map((value) => ({ value, label: t(`hr:account.maritalOption.${value}`) }))}
						onChange={(maritalStatus) => set({ maritalStatus })}
					/>
					<FilterSelect
						label={t('hr:list.scope')}
						allLabel={all}
						value={draft.scope}
						options={[
							{ value: 'organization' as const, label: t('hr:list.organizationLevel') },
							{ value: 'company' as const, label: t('hr:list.companyLevel') },
						]}
						onChange={(scope) => set({ scope })}
					/>
					<FilterSelect
						label={t('hr:list.loginFilter')}
						allLabel={all}
						value={draft.login}
						options={[
							{ value: 'yes' as const, label: t('hr:list.hasLogin') },
							{ value: 'no' as const, label: t('hr:list.noLogin') },
						]}
						onChange={(login) => set({ login })}
					/>
				</div>
				<div className='mt-1 flex items-center justify-between gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							onReset();
							setOpen(false);
						}}
					>
						{t('hr:list.reset')}
					</Button>
					<Button
						size='sm'
						onClick={() => {
							onApply(Object.fromEntries(FILTER_KEYS.map((key) => [key, draft[key]])) as TFilters);
							setOpen(false);
						}}
					>
						{t('hr:list.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
