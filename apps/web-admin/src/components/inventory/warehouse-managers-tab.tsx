import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import { UserMinus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	type TWarehouseManager,
	assignWarehouseManager,
	unassignWarehouseManager,
	warehouseManagerCandidatesQueryOptions,
	warehouseManagersQueryOptions,
} from '@/lib/warehouse-api';
import { SearchableSelect, type TSearchableOption } from './searchable-select';

/**
 * Persons in charge of one warehouse (ADR-0017).
 *
 * @remarks
 * Application-admin only: the parent detail page hides this tab for a person
 * in charge, and the backend refuses both endpoints to non-admins. The picker
 * searches **all** accounts, not one organization's members — a PIC needs no
 * membership at all, which is why it cannot reuse `GET /admin/users`.
 */
export function WarehouseManagersTab({ warehouseId }: { warehouseId: string }) {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [term, setTerm] = useState('');
	const [selected, setSelected] = useState<TSearchableOption | null>(null);

	const managers = useQuery(warehouseManagersQueryOptions(warehouseId));
	const candidates = useQuery({
		...warehouseManagerCandidatesQueryOptions(term),
		placeholderData: (previous) => previous,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({
			queryKey: ['warehouses', warehouseId, 'managers'],
		});
	};

	const assign = useMutation({
		mutationFn: (userId: string) => assignWarehouseManager(warehouseId, userId),
		onSuccess: () => {
			toast.success(t('inventory:warehouses.managerAssigned'));
			setSelected(null);
			setTerm('');
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const unassign = useMutation({
		mutationFn: (userId: string) =>
			unassignWarehouseManager(warehouseId, userId),
		onSuccess: () => {
			toast.success(t('inventory:warehouses.managerUnassigned'));
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const columns = useMemo<
		ColumnDef<DataTableFeatures, TWarehouseManager, CellData>[]
	>(
		() => [
			{
				id: 'account',
				header: t('inventory:warehouses.managerAccount'),
				meta: { cellClassName: 'font-medium' },
				cell: ({ row }) =>
					row.original.name ?? row.original.email ?? (
						<span className='text-muted-foreground'>
							{t('inventory:warehouses.managerUnknownAccount')}
						</span>
					),
			},
			{
				id: 'assignedAt',
				header: t('inventory:warehouses.managerAssignedAt'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => new Date(row.original.assignedAt).toLocaleDateString(),
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<Button
						variant='ghost'
						size='sm'
						disabled={unassign.isPending}
						onClick={async () => {
							if (
								await confirm({
									title: t('inventory:warehouses.unassignManagerConfirm'),
									destructive: true,
								})
							) {
								unassign.mutate(row.original.userId);
							}
						}}
					>
						<UserMinus className='mr-2 size-4' />
						{t('inventory:warehouses.unassignManagerAction')}
					</Button>
				),
			},
		],
		[confirm, t, unassign],
	);

	const assignedIds = new Set((managers.data ?? []).map((row) => row.userId));
	const available: TSearchableOption[] = (candidates.data ?? [])
		.filter((candidate) => !assignedIds.has(candidate.id))
		.map((candidate) => ({
			value: candidate.id,
			label: `${candidate.name} (${candidate.email})`,
		}));
	// The combobox resolves its label from the option list, so keep the chosen
	// account listed even after the search term moves away from it.
	const options =
		selected && !available.some((option) => option.value === selected.value)
			? [selected, ...available]
			: available;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('inventory:warehouses.managersTitle')}</CardTitle>
				<CardDescription>{t('inventory:warehouses.managersHint')}</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<div className='flex items-end gap-2'>
					<div className='flex w-80 flex-col gap-1'>
						<span className='text-xs text-muted-foreground'>
							{t('inventory:warehouses.assignManager')}
						</span>
						<SearchableSelect
							value={selected?.value ?? null}
							options={options}
							loading={candidates.isFetching}
							placeholder={t('inventory:warehouses.assignManagerPlaceholder')}
							emptyLabel={t('inventory:warehouses.assignManagerEmpty')}
							onSearch={setTerm}
							onChange={(value) =>
								setSelected(
									value
										? (options.find((option) => option.value === value) ?? null)
										: null,
								)
							}
						/>
					</div>
					<Button
						size='sm'
						disabled={!selected || assign.isPending}
						onClick={() => selected && assign.mutate(selected.value)}
					>
						{t('inventory:warehouses.assignManagerAction')}
					</Button>
				</div>

				{managers.isPending ? null : (managers.data ?? []).length === 0 ? (
					<p className='py-6 text-sm text-muted-foreground'>
						{t('inventory:warehouses.noManagers')}
					</p>
				) : (
					<DataTable
						columns={columns}
						data={managers.data ?? []}
						getRowId={(row) => row.userId}
					/>
				)}
			</CardContent>
		</Card>
	);
}
