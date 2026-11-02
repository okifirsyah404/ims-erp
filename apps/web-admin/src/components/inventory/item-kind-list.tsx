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
import { itemsQueryOptions, type TItemKind } from '@/lib/inventory-api';

/**
 * The item list for one kind.
 *
 * @remarks
 * One component for all four kind routes rather than four near-identical
 * pages: the kind is the only difference, and it is a filter, not a layout.
 * The sidebar exposes four separate entries (`/inventory/products`,
 * `/components`, …) so the URL stays meaningful and bookmarkable.
 */
export function ItemKindList({
	kind,
	title,
}: {
	kind: Extract<TItemKind, 'product' | 'component' | 'material' | 'tool'>;
	title: string;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const { data, isPending, isError, error } = useQuery(
		itemsQueryOptions({ itemKind: kind }),
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
			<div>
				<h1 className='text-2xl font-bold'>{title}</h1>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:items.description')}
				</p>
			</div>

			{rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>
						{t('inventory:items.empty')}
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className='p-0'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('inventory:items.sku')}</TableHead>
									<TableHead>{t('inventory:items.name')}</TableHead>
									<TableHead>{t('inventory:items.category')}</TableHead>
									<TableHead>{t('inventory:items.tracking')}</TableHead>
									<TableHead className='text-right'>
										{t('common:action.edit')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.id}>
										<TableCell className='font-mono text-xs'>
											{row.sku}
										</TableCell>
										<TableCell>
											<Link
												to='/inventory/items/$itemId'
												params={{ itemId: row.id }}
												className='hover:underline'
											>
												{row.name}
											</Link>
										</TableCell>
										<TableCell className='text-muted-foreground'>
											{row.category ?? '—'}
										</TableCell>
										<TableCell>
											{row.isSerialized ? (
												<Badge variant='secondary'>
													{t('inventory:items.serialized')}
												</Badge>
											) : (
												<Badge variant='outline'>
													{t('inventory:items.quantityTracked')}
												</Badge>
											)}
										</TableCell>
										<TableCell className='text-right'>
											<Button
												variant='ghost'
												size='sm'
												render={
													<Link
														to='/inventory/items/$itemId/edit'
														params={{ itemId: row.id }}
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
