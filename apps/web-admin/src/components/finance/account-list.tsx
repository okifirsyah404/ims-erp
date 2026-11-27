import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Archive,
	BookOpen,
	Funnel,
	Pause,
	Pencil,
	Play,
	Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
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
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	AccountFormDialog,
	type TAccountFormValues,
} from '@/components/finance/account-form-dialog';
import {
	ACCOUNT_TYPES,
	accountsQueryOptions,
	archiveAccount,
	createAccount,
	type TAccount,
	type TAccountType,
	type TCashFlowCategory,
	updateAccount,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const PAGE_SIZE = 20;

const typeKey = (t: TAccountType) => `finance:accountType.${t}` as const;
const categoryKey = (c: TCashFlowCategory) =>
	`finance:cashFlowCategory.${c}` as const;

/** Chart of accounts: filtered list, create/edit dialog, archive (M09 F2). */
export function AccountList() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const canCreate = usePermission('chart_of_account.create');
	const canUpdate = usePermission('chart_of_account.update');
	const canArchive = usePermission('chart_of_account.archive');

	const [searchDraft, setSearchDraft] = useState('');
	const [filters, setFilters] = useState<{
		search?: string;
		accountType?: TAccountType;
		isActive?: boolean;
		isPostable?: boolean;
	}>({});
	const [page, setPage] = useState(1);
	const [editing, setEditing] = useState<TAccount | null>(null);
	const [creating, setCreating] = useState(false);
	const { data, isPending, isError, error } = useQuery({
		...accountsQueryOptions({
			page,
			limit: PAGE_SIZE,
			accountType: filters.accountType,
			isActive: filters.isActive,
			isPostable: filters.isPostable,
			search: filters.search,
		}),
		placeholderData: (previous) => previous,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['accounts'] });

	const create = useMutation({
		mutationFn: (values: TAccountFormValues) => createAccount(values),
		onSuccess: async () => {
			toast.success(t('finance:accounts.created'));
			setCreating(false);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const edit = useMutation({
		mutationFn: (values: TAccountFormValues) =>
			updateAccount(editing?.id ?? '', {
				name: values.name,
				isPostable: values.isPostable,
				cashFlowCategory: values.cashFlowCategory,
				description: values.description,
			}),
		onSuccess: async () => {
			toast.success(t('finance:accounts.updated'));
			setEditing(null);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const toggleActive = useMutation({
		mutationFn: (row: TAccount) =>
			updateAccount(row.id, { isActive: !row.isActive, isPostable: !row.isActive }),
		onSuccess: async (_updated, row) => {
			toast.success(
				row.isActive
					? t('finance:accounts.deactivated')
					: t('finance:accounts.activated'),
			);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const archive = useMutation({
		mutationFn: (id: string) => archiveAccount(id),
		onSuccess: async () => {
			toast.success(t('finance:accounts.archivedDone'));
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const showActions = canUpdate || canArchive;
	const columns = useMemo<ColumnDef<DataTableFeatures, TAccount, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TAccount, CellData>[] = [
			{
				accessorKey: 'code',
				header: t('finance:common.code'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{ accessorKey: 'name', header: t('finance:common.name') },
			{
				id: 'accountType',
				header: t('finance:accounts.type'),
				cell: ({ row }) => t(typeKey(row.original.accountType)),
			},
			{
				id: 'normalBalance',
				header: t('finance:accounts.normalBalance'),
				cell: ({ row }) =>
					t(
						row.original.normalBalance === 'debit'
							? 'finance:normalBalance.debit'
							: 'finance:normalBalance.credit',
					),
			},
			{
				id: 'cashFlowCategory',
				header: t('finance:accounts.cashFlowCategory'),
				cell: ({ row }) =>
					row.original.cashFlowCategory
						? t(categoryKey(row.original.cashFlowCategory))
						: t('finance:common.none'),
			},
			{
				id: 'isPostable',
				header: t('finance:accounts.postable'),
				cell: ({ row }) => (
					<Badge variant={row.original.isPostable ? 'secondary' : 'outline'}>
						{row.original.isPostable
							? t('finance:accounts.postable')
							: t('finance:accounts.nonPostable')}
					</Badge>
				),
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.isActive ? 'secondary' : 'outline'}>
						{row.original.isActive
							? t('finance:accounts.isActive')
							: t('finance:accounts.archived')}
					</Badge>
				),
			},
		];
		if (!showActions) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('finance:common.actions')}
						disabled={archive.isPending || toggleActive.isPending}
						actions={[
							{
								key: 'edit',
								label: t('finance:accounts.edit'),
								icon: Pencil,
								hidden: !canUpdate,
								onSelect: () => setEditing(row.original),
							},
							{
								key: 'toggle-active',
								label: row.original.isActive
									? t('finance:accounts.deactivate')
									: t('finance:accounts.activate'),
								icon: row.original.isActive ? Pause : Play,
								hidden: !canUpdate,
								onSelect: () => void toggleActive.mutateAsync(row.original),
							},
							{
								key: 'archive',
								label: t('finance:accounts.archiveConfirm'),
								icon: Archive,
								hidden: !canArchive || !row.original.isActive || row.original.isSystem,
								destructive: true,
								onSelect: async () => {
									if (
										await confirm({
											title: t('finance:accounts.archiveConfirm'),
											destructive: true,
										})
									) {
										void archive.mutateAsync(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		];
	}, [
		archive,
		canArchive,
		canUpdate,
		confirm,
		showActions,
		t,
		toggleActive,
	]);

	const rows = data?.rows ?? [];
	const pagination = data?.pagination;

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='flex items-center gap-2 text-2xl font-bold'>
						<BookOpen className='size-6' />
						{t('finance:accounts.title')}
					</h1>
					<p className='text-sm text-muted-foreground'>
						{t('finance:accounts.description')}
					</p>
				</div>
			</div>

			<div className='flex flex-wrap items-end gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='text-xs text-muted-foreground'>
						{t('finance:accounts.search')}
					</span>
					<Input
						className='w-64'
						type='search'
						placeholder={t('finance:accounts.searchPlaceholder')}
						value={searchDraft}
						onChange={(event) => setSearchDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key !== 'Enter') return;
							setFilters((prev) => ({ ...prev, search: searchDraft || undefined }));
							setPage(1);
						}}
					/>
				</div>
				<AccountsFilterPopover
					accountType={filters.accountType}
					isActive={filters.isActive}
					isPostable={filters.isPostable}
					onApply={(next) => {
						setFilters((prev) => ({ ...prev, ...next }));
						setPage(1);
					}}
					onReset={() => {
						setSearchDraft('');
						setFilters({});
						setPage(1);
					}}
				/>
			</div>

			<DataTableCard
				title={t('finance:accounts.title')}
				action={
					canCreate ? (
						<Button size='sm' onClick={() => setCreating(true)}>
							<Plus className='size-4' data-icon='inline-start' />
							{t('finance:accounts.create')}
						</Button>
					) : null
				}
				description={
					pagination ? (
						t('finance:accounts.count', { count: pagination.total })
					) : isPending ? (
						<Skeleton className='h-4 w-20 motion-reduce:animate-none' />
					) : null
				}
			>
				{isError ? (
					<ErrorState error={error} size='sm' />
				) : !isPending && rows.length === 0 ? (
					<EmptyState icon={Archive} title={t('finance:accounts.empty')} size='sm' />
				) : (
					<DataTable
						columns={columns}
						data={rows}
						loading={isPending}
						getRowId={(row) => row.id}
					/>
				)}
				{pagination ? (
					<PaginationControls
						page={pagination.page}
						totalPages={pagination.totalPages}
						onPageChange={setPage}
					/>
				) : null}
			</DataTableCard>

			{creating ? (
				<AccountFormDialog
					account={null}
					submitting={create.isPending}
					onClose={() => setCreating(false)}
					onSave={(values) => void create.mutateAsync(values)}
				/>
			) : null}

			{editing ? (
				<AccountFormDialog
					account={editing}
					submitting={edit.isPending}
					onClose={() => setEditing(null)}
					onSave={(values) => void edit.mutateAsync(values)}
				/>
			) : null}
		</div>
	);
}

/**
 * Filters popover: account type, status and postable.
 *
 * @remarks
 * Edits stay local while the popover is open and only hit the URL on `Apply`;
 * the URL remains the source of truth (drafts re-sync on open).
 */
function AccountsFilterPopover({
	accountType,
	isActive,
	isPostable,
	onApply,
	onReset,
}: {
	accountType?: TAccountType;
	isActive?: boolean;
	isPostable?: boolean;
	onApply: (next: {
		accountType?: TAccountType;
		isActive?: boolean;
		isPostable?: boolean;
	}) => void;
	onReset: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const [open, setOpen] = useState(false);
	const [draftType, setDraftType] = useState<TAccountType | undefined>(accountType);
	const [draftActive, setDraftActive] = useState<boolean | undefined>(isActive);
	const [draftPostable, setDraftPostable] = useState<boolean | undefined>(isPostable);

	const activeCount = [accountType, isActive, isPostable].filter(
		(value) => value !== undefined,
	).length;

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setDraftType(accountType);
			setDraftActive(isActive);
			setDraftPostable(isPostable);
		}
		setOpen(nextOpen);
	}

	const triState = (
		value: boolean | undefined,
		onChange: (next: boolean | undefined) => void,
		labels: { all: string; yes: string; no: string },
	) => (
		<Select
			value={value === undefined ? 'all' : value ? 'true' : 'false'}
			onValueChange={(next: string | null) =>
				onChange(next === 'true' ? true : next === 'false' ? false : undefined)
			}
		>
			<SelectTrigger className='w-full'>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value='all'>{labels.all}</SelectItem>
				<SelectItem value='true'>{labels.yes}</SelectItem>
				<SelectItem value='false'>{labels.no}</SelectItem>
			</SelectContent>
		</Select>
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button variant={activeCount > 0 ? 'default' : 'outline'}>
						<Funnel className='mr-2 size-4' />
						{t('finance:accounts.filters')}
						{activeCount > 0 ? (
							<Badge variant='secondary' className='ml-2'>
								{activeCount}
							</Badge>
						) : null}
					</Button>
				}
			/>
			<PopoverContent align='start' className='w-72'>
				<PopoverHeader>
					<PopoverTitle>{t('finance:accounts.filtersTitle')}</PopoverTitle>
				</PopoverHeader>
				<div className='flex flex-col gap-3'>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('finance:accounts.type')}
						</span>
						<Select
							value={draftType ?? 'all'}
							onValueChange={(value: string | null) =>
								setDraftType(
									value === 'all' || value == null
										? undefined
										: (value as TAccountType),
								)
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>{t('finance:accounts.allTypes')}</SelectItem>
								{ACCOUNT_TYPES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(typeKey(value))}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('finance:common.status')}
						</span>
						{triState(draftActive, setDraftActive, {
							all: t('finance:accounts.allStatuses'),
							yes: t('finance:accounts.isActive'),
							no: t('finance:accounts.archived'),
						})}
					</div>
					<div className='flex flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('finance:accounts.postable')}
						</span>
						{triState(draftPostable, setDraftPostable, {
							all: t('finance:common.all'),
							yes: t('finance:accounts.postable'),
							no: t('finance:accounts.nonPostable'),
						})}
					</div>
				</div>
				<div className='mt-1 flex items-center justify-between gap-2'>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							setDraftType(undefined);
							setDraftActive(undefined);
							setDraftPostable(undefined);
							onReset();
							setOpen(false);
						}}
					>
						{t('finance:accounts.reset')}
					</Button>
					<Button
						size='sm'
						onClick={() => {
							onApply({
								accountType: draftType,
								isActive: draftActive,
								isPostable: draftPostable,
							});
							setOpen(false);
						}}
					>
						{t('finance:accounts.apply')}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
