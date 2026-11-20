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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import { Building2, Link2, Unlink } from 'lucide-react';
import {
	organizationsQueryOptions,
	type TOrganization,
} from '@/lib/organization-api';
import {
	type TWarehouseOrganizationLink,
	linkWarehouseOrganization,
	unlinkWarehouseOrganization,
	warehouseOrganizationsQueryOptions,
} from '@/lib/warehouse-api';

/**
 * Organizations tab of the warehouse detail page (ERP-0031).
 *
 * Global-admin-only: the parent page already renders inside `<AdminOnly>`.
 * Linking is idempotent; unlinking is refused by the backend with 409 while
 * the organization still holds open borrowings originating in the warehouse —
 * that error message is shown as a toast, not swallowed.
 */
export function WarehouseOrganizationsTab({
	warehouseId,
}: {
	warehouseId: string;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [selected, setSelected] = useState<string>('');

	const links = useQuery(warehouseOrganizationsQueryOptions(warehouseId));
	const organizations = useQuery(organizationsQueryOptions);

	const invalidate = () => {
		void queryClient.invalidateQueries({
			queryKey: ['warehouses', warehouseId, 'organizations'],
		});
	};

	const link = useMutation({
		mutationFn: (organizationId: string) =>
			linkWarehouseOrganization(warehouseId, organizationId),
		onSuccess: (result) => {
			toast.success(
				t(
					result.created
						? 'inventory:warehouses.linkCreated'
						: 'inventory:warehouses.linkAlreadyExists',
				),
			);
			setSelected('');
			invalidate();
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const unlink = useMutation({
		mutationFn: (organizationId: string) =>
			unlinkWarehouseOrganization(warehouseId, organizationId),
		onSuccess: (result) => {
			if (result.removed) {
				toast.success(t('inventory:warehouses.linkRemoved'));
			}
			invalidate();
		},
		// A 409 (open borrowings) lands here with the backend's localized
		// message — surfacing it is the acceptance criterion.
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const organizationRows = organizations.data?.rows;
	const columns = useMemo<
		ColumnDef<DataTableFeatures, TWarehouseOrganizationLink, CellData>[]
	>(() => {
		const byId = new Map<string, TOrganization>(
			(organizationRows ?? []).map((org) => [org.id, org]),
		);
		return [
			{
				id: 'organization',
				header: t('inventory:warehouses.organization'),
				meta: { cellClassName: 'font-medium' },
				cell: ({ row }) =>
					(row.original.organizationId
						? byId.get(row.original.organizationId)?.name
						: undefined) ??
					row.original.organizationId ??
					'-',
			},
			{
				id: 'linkedSince',
				header: t('inventory:warehouses.linkedSince'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
			},
			{
				id: 'actions',
				header: '',
				meta: { align: 'right' },
				cell: ({ row }) => (
					<Button
						variant='ghost'
						size='sm'
						disabled={unlink.isPending || !row.original.organizationId}
						onClick={async () => {
							const organizationId = row.original.organizationId;
							if (
								organizationId &&
								(await confirm({
									title: t('inventory:warehouses.unlinkConfirm'),
									destructive: true,
								}))
							) {
								unlink.mutate(organizationId);
							}
						}}
					>
						<Unlink className='mr-2 size-4' />
						{t('inventory:warehouses.unlinkAction')}
					</Button>
				),
			},
		];
	}, [confirm, organizationRows, t, unlink]);

	const linkedIds = new Set((links.data ?? []).map((row) => row.organizationId));
	const candidates = (organizations.data?.rows ?? []).filter(
		(org) => !linkedIds.has(org.id) && org.deletedAt === null,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('inventory:warehouses.linkedOrganizations')}</CardTitle>
				<CardDescription>
					{t('inventory:warehouses.linkedOrganizationsHint')}
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<div className='flex items-center gap-2'>
					<Select value={selected} onValueChange={(value) => setSelected(value ?? '')}>
						<SelectTrigger className='w-72'>
							<SelectValue
								placeholder={t('inventory:warehouses.selectOrganization')}
							/>
						</SelectTrigger>
						<SelectContent>
							{candidates.map((org) => (
								<SelectItem key={org.id} value={org.id}>
									{org.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						size='sm'
						disabled={selected === '' || link.isPending}
						onClick={() => link.mutate(selected)}
					>
						<Link2 className='mr-2 size-4' />
						{t('inventory:warehouses.linkAction')}
					</Button>
				</div>

				{links.isError ? (
					<ErrorState error={links.error} size='sm' />
				) : !links.isPending && (links.data ?? []).length === 0 ? (
					<EmptyState
						icon={Building2}
						title={t('inventory:warehouses.noLinkedOrganizations')}
						size='sm'
					/>
				) : (
					<DataTable
						columns={columns}
						data={links.data ?? []}
						getRowId={(row) => row.organizationId ?? ''}
						loading={links.isPending}
					/>
				)}
			</CardContent>
		</Card>
	);
}
