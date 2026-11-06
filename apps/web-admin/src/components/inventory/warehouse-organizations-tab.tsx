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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import { Building2, Link2, Unlink } from 'lucide-react';
import {
	organizationsQueryOptions,
	type TOrganization,
} from '@/lib/organization-api';
import {
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

	const byId = new Map<string, TOrganization>(
		(organizations.data?.rows ?? []).map((org) => [org.id, org]),
	);
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

				{links.isPending ? null : (links.data ?? []).length === 0 ? (
					<div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
						<Building2 className='size-4' />
						{t('inventory:warehouses.noLinkedOrganizations')}
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									{t('inventory:warehouses.organization')}
								</TableHead>
								<TableHead>
									{t('inventory:warehouses.linkedSince')}
								</TableHead>
								<TableHead className='w-24' />
							</TableRow>
						</TableHeader>
						<TableBody>
							{(links.data ?? []).map((row) => (
								<TableRow key={row.organizationId}>
									<TableCell className='font-medium'>
										{byId.get(row.organizationId)?.name ??
											row.organizationId}
									</TableCell>
									<TableCell className='text-muted-foreground'>
										{new Date(row.createdAt).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<Button
											variant='ghost'
											size='sm'
											disabled={unlink.isPending}
											onClick={() => {
												if (
													window.confirm(
														t('inventory:warehouses.unlinkConfirm'),
													)
												) {
													unlink.mutate(row.organizationId);
												}
											}}
										>
											<Unlink className='mr-2 size-4' />
											{t('inventory:warehouses.unlinkAction')}
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
