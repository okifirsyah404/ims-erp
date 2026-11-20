import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@ims-erp/ui/components/alert-dialog';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { AdminOnly } from '@/components/inventory/admin-only';
import { useItemCategoryNames } from '@/lib/item-category-api';
import {
	archiveProduct,
	productQueryOptions,
	productSerialsQueryOptions,
	registerSerial,
	replaceProvisionalSerial,
	type TProduct,
	type TProductSerial,
} from '@/lib/inventory-api';
import { DocumentImageField } from '@/components/documents/document-image-field';
import { removeDocumentImage, uploadDocumentImage } from '@/lib/document-image-api';
import { usePermission } from '@/lib/use-permission';

/**
 * `/inventory/items/$itemId` — product detail plus its serialized units.
 *
 * @remarks
 * The path keeps its historical `items` segment; `$itemId` is a **product** id
 * (`/products/:id` on the backend). Physical assets live under
 * `/assets`.
 */
export const Route = createFileRoute('/_authed/inventory/items/$itemId')({
	component: ItemDetailPage,
});

function ItemDetailPage() {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const categoryNames = useItemCategoryNames();
	const { itemId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: item, isPending, isError, error } = useQuery(productQueryOptions(itemId));
	const { data: units } = useQuery(productSerialsQueryOptions(itemId));

	const [archiving, setArchiving] = useState(false);
	const canUpdate = usePermission('product.update');
	const setItem = (saved: TProduct) => queryClient.setQueryData(productQueryOptions(itemId).queryKey, saved);

	if (isPending) return <PageSkeleton />;

	if (isError) return <ErrorState error={error} bordered />;

	if (!item) {
		return (
			<AdminOnly>
				<EmptyState title={t('product:detail.notFound')} bordered />
			</AdminOnly>
		);
	}

	async function handleArchive() {
		setArchiving(true);
		try {
			await archiveProduct(itemId);
			toast.success(t('product:form.archived'));
			await queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
			void navigate({ to: '/products' });
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setArchiving(false);
		}
	}

	return (
		<AdminOnly>
			<div className='flex flex-col gap-6'>
				<div className='flex items-start justify-between'>
					<div>
						<div className='flex items-center gap-2'>
							<h1 className='text-2xl font-bold'>{item.name}</h1>
							<Badge variant='outline'>{t(`product:kind.${item.productKind}`)}</Badge>
						</div>
						<p className='font-mono text-xs text-muted-foreground'>
							{item.code} · {item.sku}
						</p>
					</div>
					<div className='flex gap-2'>
						<Button
							variant='outline'
							render={
								<Link
									to='/inventory/items/$itemId/edit'
									params={{ itemId }}
								/>
							}
						>
							{t('common:action.edit')}
						</Button>
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button variant='destructive' disabled={archiving}>
										{t('product:detail.archive')}
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t('product:detail.archiveConfirm')}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{t('product:detail.archiveConfirmBody')}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										{t('common:action.cancel')}
									</AlertDialogCancel>
									<AlertDialogAction onClick={() => void handleArchive()}>
										{t('product:detail.archive')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>{t('product:items.details')}</CardTitle>
					</CardHeader>
					<CardContent className='grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4'>
						<Detail
							label={t('product:items.category')}
							value={item.productCategoryId ? (categoryNames.get(item.productCategoryId) ?? null) : null}
						/>
						<Detail label={t('product:items.brand')} value={item.brand} />
						<Detail
							label={t('product:items.isActive')}
							value={item.isActive ? t('product:items.isActive') : t('product:items.inactive')}
						/>
						<Detail label={t('product:items.unitLabel')} value={item.unitLabel} />
						<Detail label={t('product:items.barcode')} value={item.barcode} />
						<Detail
							label={t('product:items.minStockQty')}
							value={item.minStockQty}
						/>
						<Detail
							label={t('product:items.sellingPrice')}
							value={String(item.sellingPrice)}
						/>
						<Detail
							label={t('product:items.purchasePrice')}
							value={String(item.purchasePrice)}
						/>
						<Detail
							label={t('product:items.tracking')}
							value={
								item.isSerialized
									? t('product:items.serialized')
									: t('product:items.quantityTracked')
							}
						/>
						<Detail
							label={t('product:items.description_label')}
							value={item.description}
						/>
					</CardContent>
				</Card>

				{item.specification && (
					<Card>
						<CardHeader>
							<CardTitle>{t('product:items.specification')}</CardTitle>
						</CardHeader>
						<CardContent className='text-sm'>
							<p className='whitespace-pre-line'>{item.specification}</p>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardContent className='p-4'>
						<DocumentImageField
							label={t('product:items.documentPhoto')}
							hint={t('product:items.documentPhotoHint')}
							imageUrl={item.imageUrl}
							disabled={!canUpdate}
							onUpload={async (file) => {
								setItem(await uploadDocumentImage<TProduct>(`/products/${itemId}/image`, file));
							}}
							onRemove={async () => {
								setItem(await removeDocumentImage<TProduct>(`/products/${itemId}/image`));
							}}
						/>
					</CardContent>
				</Card>

				{item.isSerialized ? (
					<UnitsPanel itemId={itemId} units={units ?? []} />
				) : null}
			</div>
		</AdminOnly>
	);
}

function Detail({
	label,
	value,
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div className='flex flex-col gap-1'>
			<span className='text-xs text-muted-foreground'>{label}</span>
			<span>{value ?? '—'}</span>
		</div>
	);
}

/**
 * The serial list for a serialized product.
 *
 * @remarks
 * Registering needs a real serial number: the backend's `POST
 * /products/:id/units` contract rejects an empty one, so the form can
 * no longer mint a `pre_order` unit with a provisional serial. Provisional
 * serials that already exist (from purchasing) can still be replaced exactly
 * once, and the replace control is only offered while the unit is provisional.
 */
function UnitsPanel({ itemId, units }: { itemId: string; units: TProductSerial[] }) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const queryClient = useQueryClient();
	const [serial, setSerial] = useState('');
	const [registering, setRegistering] = useState(false);

	const refresh = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: productSerialsQueryOptions(itemId).queryKey,
			}),
			queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] }),
		]);
	}, [itemId, queryClient]);

	async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRegistering(true);
		try {
			await registerSerial(itemId, {
				serialNumber: serial.trim(),
				status: 'in_stock',
			});
			toast.success(t('product:unit.registered'));
			setSerial('');
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		} finally {
			setRegistering(false);
		}
	}

	const handleReplace = useCallback(
		async (unitId: string, nextSerial: string) => {
			try {
				await replaceProvisionalSerial(itemId, unitId, nextSerial);
				toast.success(t('product:unit.replaced'));
				await refresh();
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : t('common:error.failed'),
				);
			}
		},
		[itemId, refresh, t],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TProductSerial, CellData>[]>(
		() => [
			{
				id: 'serialNumber',
				header: t('product:detail.serialNumber'),
				meta: { cellClassName: 'font-mono text-xs' },
				cell: ({ row }) => (
					<>
						{row.original.serialNumber}
						{row.original.isProvisionalSerial && (
							<Badge variant='outline' className='ml-2'>
								{t('product:detail.provisional')}
							</Badge>
						)}
					</>
				),
			},
			{
				id: 'status',
				header: t('product:detail.status'),
				cell: ({ row }) => (
					<Badge variant='secondary'>
						{t(`product:status.${row.original.status}`)}
					</Badge>
				),
			},
			{
				id: 'assetTag',
				header: t('product:detail.assetTag'),
				meta: { cellClassName: 'text-muted-foreground' },
				cell: ({ row }) => row.original.assetTag ?? '—',
			},
			{
				id: 'replace',
				header: t('product:unit.replaceSerial'),
				meta: { align: 'right' },
				cell: ({ row }) =>
					row.original.isProvisionalSerial ? (
						<ReplaceSerialButton
							onReplace={(nextSerial) =>
								void handleReplace(row.original.id, nextSerial)
							}
						/>
					) : (
						'—'
					),
			},
		],
		[handleReplace, t],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('product:detail.units')}</CardTitle>
				<CardDescription>
					{t('product:unit.newDescription')}
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<form onSubmit={handleRegister} className='flex items-end gap-2'>
					<Field className='flex-1'>
						<FieldLabel htmlFor='serial'>
							{t('product:unit.serialNumber')}
						</FieldLabel>
						<Input
							id='serial'
							required
							value={serial}
							onChange={(event) => setSerial(event.target.value)}
						/>
						<FieldDescription>
							{t('product:unit.serialNumberHint')}
						</FieldDescription>
					</Field>
					<Button type='submit' disabled={registering}>
						{registering
							? t('product:unit.registering')
							: t('product:unit.register')}
					</Button>
				</form>

				{units.length === 0 ? (
					<p className='text-sm text-muted-foreground'>
						{t('product:detail.unitsEmpty')}
					</p>
				) : (
					<DataTable
						columns={columns}
						data={units}
						getRowId={(unit) => unit.id}
					/>
				)}
			</CardContent>
		</Card>
	);
}

/** Inline dialog that collects the real serial for a pre-ordered unit. */
function ReplaceSerialButton({
	onReplace,
}: {
	onReplace: (serialNumber: string) => void;
}) {
	const { t } = useTranslation(['inventory', 'common', 'product']);
	const [value, setValue] = useState('');

	return (
		<AlertDialog>
			<AlertDialogTrigger
				render={
					<Button variant='ghost' size='sm'>
						{t('product:unit.replaceSerial')}
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('product:unit.replaceSerial')}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('product:unit.replaceSerialBody')}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Input
					value={value}
					placeholder={t('product:unit.serialNumber')}
					onChange={(event) => setValue(event.target.value)}
				/>
				<AlertDialogFooter>
					<AlertDialogCancel>{t('common:action.cancel')}</AlertDialogCancel>
					<AlertDialogAction
						disabled={!value.trim()}
						onClick={() => onReplace(value.trim())}
					>
						{t('common:action.save')}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
