import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Funnel,
	RotateCcw,
	Truck,
	UserX,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { Input } from '@ims-erp/ui/components/input';
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from '@ims-erp/ui/components/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { SupplierFormDialog } from '@/components/procurement/supplier-form-dialog';
import { toast } from '@/components/toast';
import {
	createSupplierCompany,
	SUPPLIER_SORT_FIELDS,
	setSupplierCompanyActive,
	supplierCompaniesQueryOptions,
	type TSupplierCompany,
	type TSupplierCompanyInput,
	type TSupplierSortDir,
	type TSupplierSortField,
} from '@/lib/supplier-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

/** Search params of the suppliers table (URL-backed filters). */
type TSuppliersSearch = {
	page?: number;
	search?: string;
	status?: 'active' | 'inactive';
	sortBy?: TSupplierSortField;
	sortDir?: TSupplierSortDir;
};

/** `/procurement/suppliers` — the supplier master (ADR-0011 step 4a). */
export const Route = createFileRoute('/_authed/procurement/suppliers/')({
	validateSearch: (search: Record<string, unknown>): TSuppliersSearch => ({
		page: search.page ? Number(search.page) || 1 : undefined,
		search: typeof search.search === 'string' && search.search ? search.search : undefined,
		status: search.status === 'active' || search.status === 'inactive' ? search.status : undefined,
		sortBy: SUPPLIER_SORT_FIELDS.includes(search.sortBy as TSupplierSortField)
			? (search.sortBy as TSupplierSortField)
			: undefined,
		sortDir: search.sortDir === 'asc' || search.sortDir === 'desc' ? search.sortDir : undefined,
	}),
	component: SupplierListPage,
});

function SupplierListPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const canCreate = usePermission('supplier.create');
	const canArchive = usePermission('supplier.archive');
	const canSeeBank = usePermission('supplier.read_bank');
	const [creating, setCreating] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [searchDraft, setSearchDraft] = useState(search.search ?? '');

	const params = {
		page: search.page ?? 1,
		limit: PAGE_SIZE,
		search: search.search,
		status: search.status,
		sortBy: search.sortBy ?? 'name',
		sortDir: search.sortDir ?? 'asc',
	} as const;
	const { data, isPending, isError, error } = useQuery(supplierCompaniesQueryOptions(params));

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: ['procurement', 'suppliers'] });
	}

	async function handleCreate(input: Partial<TSupplierCompanyInput>) {
		setSubmitting(true);
		try {
			const created = await createSupplierCompany(input);
			await refresh();
			toast.success(t('procurement:suppliers.saved'));
			setCreating(false);
			void navigate({ to: '/procurement/suppliers/$supplierId', params: { supplierId: created.id } });
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	async function toggleActive(company: TSupplierCompany) {
		try {
			await setSupplierCompanyActive(company.id, company.status !== 'active');
			await refresh();
			toast.success(
				company.status === 'active'
					? t('procurement:suppliers.deactivated')
					: t('procurement:suppliers.activated'),
			);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		}
	}

	/** Toggles the sort column, flipping direction when already active. */
	function toggleSort(field: TSupplierSortField) {
		void navigate({
			search: (prev) => ({
				...prev,
				page: 1,
				sortBy: field,
				sortDir:
					(prev.sortBy ?? 'name') === field
						? (prev.sortDir ?? 'asc') === 'asc'
							? 'desc'
							: 'asc'
						: 'asc',
			}),
		});
	}

	function sortIcon(field: TSupplierSortField) {
		const active = (search.sortBy ?? 'name') === field;
		if (!active) return <ArrowUpDown className='ml-1 size-3' aria-hidden='true' />;
		return (search.sortDir ?? 'asc') === 'asc' ? (
			<ArrowUp className='ml-1 size-3' aria-hidden='true' />
		) : (
			<ArrowDown className='ml-1 size-3' aria-hidden='true' />
		);
	}

	/** Server-driven sort header: the URL holds the sort, not the table. */
	function sortHeader(label: string, field: TSupplierSortField) {
		return () => (
			<Button variant='ghost' size='sm' className='-ml-2 h-8' onClick={() => toggleSort(field)}>
				{label}
				{sortIcon(field)}
			</Button>
		);
	}

	const columns = useMemo<ColumnDef<DataTableFeatures, TSupplierCompany, CellData>[]>(
		() => [
			{
				id: 'name',
				header: sortHeader(t('procurement:supplier.name'), 'name'),
				cell: ({ row }) => (
					<Link
						to='/procurement/suppliers/$supplierId'
						params={{ supplierId: row.original.id }}
						className='font-medium hover:underline'
					>
						{row.original.name}
					</Link>
				),
			},
			{
				id: 'code',
				header: sortHeader(t('procurement:supplier.code'), 'code'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => row.original.code,
			},
			{
				id: 'supplierType',
				header: t('procurement:supplier.supplierType'),
				cell: ({ row }) => t(`procurement:supplierType.${row.original.supplierType}`),
			},
			{
				id: 'contact',
				header: t('procurement:suppliers.contact'),
				cell: ({ row }) => (
					<div className='flex flex-col text-xs'>
						<span>{row.original.email ?? '—'}</span>
						<span className='text-muted-foreground'>{row.original.phone ?? '—'}</span>
					</div>
				),
			},
			{
				id: 'status',
				header: t('procurement:supplier.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.status === 'active' ? 'default' : 'outline'}>
						{t(`common:status.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.edit')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('procurement:suppliers.actions')}
						actions={[
							{
								key: 'toggle',
								label:
									row.original.status === 'active'
										? t('procurement:suppliers.deactivate')
										: t('procurement:suppliers.activate'),
								icon: row.original.status === 'active' ? UserX : RotateCcw,
								hidden: !canArchive,
								onSelect: () => void toggleActive(row.original),
							},
						]}
					/>
				),
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[t, canArchive, search.sortBy, search.sortDir],
	);

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='flex items-center gap-2 text-2xl font-bold'>
						<Truck className='size-6' />
						{t('procurement:suppliers.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>{t('procurement:suppliers.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setCreating(true)}>{t('procurement:suppliers.new')}</Button>}
			</div>

			{/* Filters ------------------------------------------------------ */}
			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('procurement:suppliers.search')}</span>
					<Input
						className='w-64'
						type='search'
						placeholder={t('procurement:suppliers.searchPlaceholder')}
						value={searchDraft}
						onChange={(event) => setSearchDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key !== 'Enter') return;
							void navigate({
								search: (prev) => ({ ...prev, page: 1, search: searchDraft || undefined }),
							});
						}}
					/>
				</div>
				<SuppliersFilterPopover
					status={search.status}
					onApply={(status) =>
						void navigate({ search: (prev) => ({ ...prev, page: 1, status }) })
					}
					onReset={() => {
						setSearchDraft('');
						void navigate({ search: {} });
					}}
				/>
			</div>

			{/* Table -------------------------------------------------------- */}
			<Card>
				<CardHeader>
					<CardTitle>{t('procurement:suppliers.title')}</CardTitle>
					<CardDescription>
						{pagination ? (
							t('procurement:suppliers.count', { count: pagination.total })
						) : isPending ? (
							<Skeleton className='h-4 w-20 motion-reduce:animate-none' />
						) : null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isError && <ErrorState error={error} size='sm' />}
					{!isPending && !isError && rows.length === 0 && (
						<EmptyState icon={Truck} title={t('procurement:suppliers.empty')} size='sm' />
					)}
					{(isPending || rows.length > 0) && (
						<DataTable
							columns={columns}
							data={rows}
							getRowId={(row) => row.id}
							loading={isPending}
						/>
					)}
					{pagination && (
						<PaginationControls
							page={pagination.page}
							totalPages={pagination.totalPages}
							onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
						/>
					)}
				</CardContent>
			</Card>

			{creating && (
				<SupplierFormDialog
					supplier={null}
					canSeeBank={canSeeBank}
					submitting={submitting}
					onClose={() => setCreating(false)}
					onSave={(input) => void handleCreate(input)}
				/>
			)}
		</div>
	);
}

/**
 * Filters popover: the status select with draft state.
 *
 * @remarks
 * Edits stay local while the popover is open and only hit the URL on `Apply`;
 * the URL remains the source of truth (drafts re-sync on open).
 */
function SuppliersFilterPopover({
	status,
	onApply,
	onReset,
}: {
	status?: 'active' | 'inactive';
	onApply: (status?: 'active' | 'inactive') => void;
	onReset: () => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [open, setOpen] = useState(false);
	const [draftStatus, setDraftStatus] = useState<'active' | 'inactive' | undefined>(status);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) setDraftStatus(status);
		setOpen(nextOpen);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button variant={status ? 'default' : 'outline'}>
						<Funnel className='mr-2 size-4' />
						{t('procurement:suppliers.filters')}
						{status && (
							<Badge variant='secondary' className='ml-2'>
								1
							</Badge>
						)}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-64'>
				<PopoverHeader>
					<PopoverTitle>{t('procurement:suppliers.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>{t('procurement:supplier.status')}</span>
					<Select
						value={draftStatus ?? 'all'}
						onValueChange={(value: string | null) =>
							setDraftStatus(value === 'all' || value == null ? undefined : (value as 'active' | 'inactive'))
						}
					>
						<SelectTrigger className='w-full'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('procurement:suppliers.allStatuses')}</SelectItem>
							<SelectItem value='active'>{t('common:status.active')}</SelectItem>
							<SelectItem value='inactive'>{t('common:status.inactive')}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className='mt-1 flex items-center justify-between gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							setDraftStatus(undefined);
							onReset();
							setOpen(false);
						}}
					>
						{t('procurement:suppliers.reset')}
					</Button>
					<Button
						size='sm'
						onClick={() => {
							onApply(draftStatus);
							setOpen(false);
						}}
					>
						{t('procurement:suppliers.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
