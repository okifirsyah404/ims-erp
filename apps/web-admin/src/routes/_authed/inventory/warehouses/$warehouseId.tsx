import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { AdminOnly } from '@/components/inventory/admin-only';
import { warehouseQueryOptions } from '@/lib/warehouse-api';

/** `/inventory/warehouses/$warehouseId` — one warehouse with address and bins. */
export const Route = createFileRoute('/_authed/inventory/warehouses/$warehouseId')({
	component: WarehouseDetailPage,
});

function WarehouseDetailPage() {
	const { t } = useTranslation(['inventory', 'common']);
	const { warehouseId } = useParams({ from: Route.id });
	const { data: warehouse, isPending, isError } = useQuery(
		warehouseQueryOptions(warehouseId),
	);

	if (isPending) return null;

	if (isError || !warehouse) {
		return (
			<AdminOnly>
				<p className='p-6 text-sm text-muted-foreground'>
					{t('inventory:warehouses.notFound')}
				</p>
			</AdminOnly>
		);
	}

	return (
		<AdminOnly>
			<div className='flex flex-col gap-6 p-6'>
				<div className='flex items-start justify-between gap-4'>
					<div>
						<h1 className='text-2xl font-bold'>{warehouse.name}</h1>
						<p className='font-mono text-sm text-muted-foreground'>
							{warehouse.code}
						</p>
					</div>
					<div className='flex gap-2'>
						{warehouse.isDefault ? (
							<Badge>{t('inventory:warehouses.default')}</Badge>
						) : null}
						<Button
							variant='outline'
							render={
								<Link
									to='/inventory/warehouses/$warehouseId/edit'
									params={{ warehouseId }}
								/>
							}
						>
							{t('common:action.edit')}
						</Button>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>{t('inventory:warehouseForm.address')}</CardTitle>
					</CardHeader>
					<CardContent className='text-sm'>
						{warehouse.address ? (
							<p className='text-muted-foreground'>
								{[
									warehouse.address.street,
									warehouse.address.rt && `RT ${warehouse.address.rt}`,
									warehouse.address.rw && `RW ${warehouse.address.rw}`,
									warehouse.address.postalCode,
								]
									.filter(Boolean)
									.join(', ')}
							</p>
						) : (
							<p className='text-muted-foreground'>
								{t('inventory:warehouses.noAddress')}
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t('inventory:warehouses.storages')}</CardTitle>
					</CardHeader>
					<CardContent className='p-0'>
						{warehouse.storages.length === 0 ? (
							<p className='px-6 pb-6 text-sm text-muted-foreground'>
								{t('inventory:warehouses.noStorages')}
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('inventory:warehouses.code')}</TableHead>
										<TableHead>{t('inventory:warehouses.name')}</TableHead>
										<TableHead>{t('inventory:warehouses.binType')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{warehouse.storages.map((storage) => (
										<TableRow key={storage.id}>
											<TableCell className='font-mono text-xs'>
												{storage.code}
											</TableCell>
											<TableCell>{storage.name ?? '—'}</TableCell>
											<TableCell className='text-muted-foreground'>
												{storage.binType ?? '—'}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</AdminOnly>
	);
}
