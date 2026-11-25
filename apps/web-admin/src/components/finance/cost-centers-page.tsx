import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Archive, Network, Pencil, Plus } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	archiveCostCenter,
	costCentersQueryOptions,
	createCostCenter,
	type TCostCenter,
	updateCostCenter,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const routeApi = getRouteApi('/_authed/finance/cost-centers/');
const PAGE_SIZE = 50;
const NONE = 'none';

/** Cost centres (ERP-0127): list, create/edit, deactivate. */
export function CostCentersPage() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const navigate = routeApi.useNavigate();
	const search = routeApi.useSearch();
	const queryClient = useQueryClient();
	const canRead = usePermission('cost_center.read');
	const canCreate = usePermission('cost_center.create');
	const canUpdate = usePermission('cost_center.update');
	const canArchive = usePermission('cost_center.archive');
	const [dialog, setDialog] = useState<{ center: TCostCenter | null } | null>(null);
	const [term, setTerm] = useState(search.search ?? '');

	const page = search.page ?? 1;
	const { data, isPending, isError, error } = useQuery({
		...costCentersQueryOptions({ page, limit: PAGE_SIZE, search: search.search }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});
	const { data: parents } = useQuery({
		...costCentersQueryOptions({ page: 1, limit: 100, isActive: true }),
		enabled: canRead && dialog != null,
	});

	const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
	const archive = useMutation({
		mutationFn: (id: string) => archiveCostCenter(id),
		onSuccess: () => {
			toast.success(t('finance:costCenters.archived'));
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TCostCenter, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TCostCenter, CellData>[] = [
			{ accessorKey: 'code', header: t('finance:common.code'), meta: { cellClassName: 'font-mono text-xs' } },
			{ accessorKey: 'name', header: t('finance:common.name') },
			{
				id: 'description',
				header: t('finance:common.description'),
				meta: { cellClassName: 'max-w-72 truncate' },
				cell: ({ row }) => row.original.description ?? t('finance:common.none'),
			},
			{
				id: 'status',
				header: t('finance:common.status'),
				cell: ({ row }) => (
					<Badge variant={row.original.isActive ? 'secondary' : 'outline'}>
						{row.original.isActive ? t('finance:costCenters.active') : t('finance:costCenters.inactive')}
					</Badge>
				),
			},
		];
		if (!canUpdate && !canArchive) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('finance:common.actions')}
						disabled={archive.isPending}
						actions={[
							{
								key: 'edit',
								label: t('common:action.edit'),
								icon: Pencil,
								hidden: !canUpdate,
								onSelect: () => setDialog({ center: row.original }),
							},
							{
								key: 'archive',
								label: t('finance:costCenters.archive'),
								icon: Archive,
								destructive: true,
								hidden: !canArchive || !row.original.isActive,
								onSelect: async () => {
									if (await confirm({ title: t('finance:costCenters.archiveConfirm'), destructive: true })) {
										void archive.mutateAsync(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		];
	}, [archive, canArchive, canUpdate, confirm, t]);

	if (!canRead) {
		return <EmptyState icon={Network} title={t('finance:costCenters.title')} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:costCenters.title')}</h1>
					<p className='text-muted-foreground text-sm'>{t('finance:costCenters.description')}</p>
				</div>
				{canCreate ? (
					<Button size='sm' onClick={() => setDialog({ center: null })}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:costCenters.create')}
					</Button>
				) : null}
			</div>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void navigate({ search: (prev) => ({ ...prev, page: undefined, search: term.trim() || undefined }) });
				}}
			>
				<Input
					className='w-72'
					placeholder={t('finance:costCenters.search')}
					value={term}
					onChange={(event) => setTerm(event.target.value)}
				/>
			</form>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && (data?.rows.length ?? 0) === 0 ? (
					<EmptyState icon={Network} title={t('finance:costCenters.empty')} />
				) : (
					<DataTable columns={columns} data={data?.rows ?? []} loading={isPending} getRowId={(row) => row.id} />
				)}
				<PaginationControls
					page={page}
					totalPages={data?.pagination.totalPages ?? 1}
					onPageChange={(next) => void navigate({ search: (prev) => ({ ...prev, page: next }) })}
				/>
			</DataTableCard>
			{dialog ? (
				<CostCenterDialog
					center={dialog.center}
					parents={(parents?.rows ?? []).filter((p) => p.id !== dialog.center?.id)}
					onClose={() => setDialog(null)}
					onSaved={() => {
						setDialog(null);
						invalidate();
					}}
				/>
			) : null}
		</div>
	);
}

function CostCenterDialog({
	center,
	parents,
	onClose,
	onSaved,
}: {
	center: TCostCenter | null;
	parents: TCostCenter[];
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const [code, setCode] = useState(center?.code ?? '');
	const [name, setName] = useState(center?.name ?? '');
	const [parentId, setParentId] = useState(center?.parentCostCenterId ?? NONE);
	const [description, setDescription] = useState(center?.description ?? '');

	const save = useMutation({
		mutationFn: () => {
			const parentCostCenterId = parentId === NONE ? null : parentId;
			return center
				? updateCostCenter(center.id, { name: name.trim(), parentCostCenterId, description: description.trim() || null })
				: createCostCenter({
						code: code.trim().toUpperCase(),
						name: name.trim(),
						parentCostCenterId,
						description: description.trim() || null,
					});
		},
		onSuccess: () => {
			toast.success(t('finance:costCenters.saved'));
			onSaved();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						void save.mutateAsync();
					}}
				>
					<DialogHeader>
						<DialogTitle>{center ? t('finance:costCenters.edit') : t('finance:costCenters.create')}</DialogTitle>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='cost-center-code'>{t('finance:common.code')}</FieldLabel>
						<Input
							id='cost-center-code'
							value={code}
							maxLength={32}
							disabled={center != null}
							onChange={(event) => setCode(event.target.value)}
						/>
						{center ? <FieldDescription>{t('finance:costCenters.codeImmutable')}</FieldDescription> : null}
					</Field>
					<Field>
						<FieldLabel htmlFor='cost-center-name'>{t('finance:common.name')}</FieldLabel>
						<Input id='cost-center-name' value={name} onChange={(event) => setName(event.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor='cost-center-parent' optional>
							{t('finance:costCenters.parent')}
						</FieldLabel>
						<Select value={parentId} onValueChange={(v: string | null) => setParentId(v ?? NONE)}>
							<SelectTrigger id='cost-center-parent'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:common.none')}</SelectItem>
								{parents.map((parent) => (
									<SelectItem key={parent.id} value={parent.id}>
										{parent.code} — {parent.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='cost-center-description' optional>
							{t('finance:common.description')}
						</FieldLabel>
						<Textarea
							id='cost-center-description'
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={save.isPending || !code.trim() || !name.trim()}>
							{save.isPending ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
