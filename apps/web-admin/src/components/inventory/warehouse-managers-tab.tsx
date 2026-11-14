import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { UserMinus } from 'lucide-react';
import { toast } from '@/components/toast';
import {
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
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('inventory:warehouses.managerAccount')}</TableHead>
								<TableHead>
									{t('inventory:warehouses.managerAssignedAt')}
								</TableHead>
								<TableHead className='w-24' />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(managers.data ?? []).map((row) => (
								<TableRow key={row.userId}>
									<TableCell className='font-medium'>
										{row.name ?? row.email ?? (
											<span className='text-muted-foreground'>
												{t('inventory:warehouses.managerUnknownAccount')}
											</span>
										)}
									</TableCell>
									<TableCell className='text-muted-foreground'>
										{new Date(row.assignedAt).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<Button
											variant='ghost'
											size='sm'
											disabled={unassign.isPending}
											onClick={() => {
												if (
													window.confirm(
														t('inventory:warehouses.unassignManagerConfirm'),
													)
												) {
													unassign.mutate(row.userId);
												}
											}}
										>
											<UserMinus className='mr-2 size-4' />
											{t('inventory:warehouses.unassignManagerAction')}
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
