import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { useQuery } from '@tanstack/react-query';
import { warehousesQueryOptions } from '@/lib/warehouse-api';

/**
 * The warehouse list.
 *
 * @remarks
 * Shows every scope at once, because the only callers are application
 * administrators: a global admin manages global and per-organization
 * warehouses together and needs to see the difference at a glance, which the
 * scope badge provides.
 */
export function WarehouseList() {
	const { t } = useTranslation(['inventory', 'common']);
	const { data, isPending, isError, error } = useQuery(
		warehousesQueryOptions({ limit: 100 }),
	);

	if (isPending) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{t('common:state.loading')}
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card>
				<CardContent className='py-8 text-center text-sm text-muted-foreground'>
					{error instanceof Error ? error.message : t('common:error.failed')}
				</CardContent>
			</Card>
		);
	}

	const rows = data?.rows ?? [];

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{t('inventory:warehouses.title')}</h1>
					<p className='text-sm text-muted-foreground'>
						{t('inventory:warehouses.description')}
					</p>
				</div>
				<Button
					render={<Link to='/inventory/warehouses/new' />}
					className='shrink-0'
				>
					{t('inventory:warehouses.new')}
				</Button>
			</div>

			{rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{t('inventory:warehouses.empty')}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('inventory:warehouses.code')}</TableHead>
									<TableHead>{t('inventory:warehouses.name')}</TableHead>
									<TableHead>{t('inventory:warehouses.scope')}</TableHead>
									<TableHead>{t('inventory:warehouses.status')}</TableHead>
									<TableHead className='text-right'>
										{t('common:action.edit')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.id}>
										<TableCell className='font-mono text-xs'>
											{row.code}
										</TableCell>
										<TableCell>
											<Link
												to='/inventory/warehouses/$warehouseId'
												params={{ warehouseId: row.id }}
												className='hover:underline'
											>
												{row.name}
											</Link>
										</TableCell>
										<TableCell>
											{/* Global rows are `organization_id IS NULL`. */}
											{row.organizationId === null ? (
												<Badge variant='secondary'>
													{t('inventory:warehouses.global')}
												</Badge>
											) : (
												<Badge variant='outline'>
													{t('inventory:warehouses.organization')}
												</Badge>
											)}
										</TableCell>
										<TableCell className='flex gap-2'>
											{row.isDefault ? (
												<Badge>{t('inventory:warehouses.default')}</Badge>
											) : null}
											{row.isActive ? null : (
												<Badge variant='outline'>
													{t('inventory:warehouses.inactive')}
												</Badge>
											)}
										</TableCell>
										<TableCell className='text-right'>
											<Button
												variant='ghost'
												size='sm'
												render={
													<Link
														to='/inventory/warehouses/$warehouseId/edit'
														params={{ warehouseId: row.id }}
													/>
												}
											>
												{t('common:action.edit')}
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
