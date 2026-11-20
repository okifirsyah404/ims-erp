import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
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
 * (`/inventory/products/:id` on the backend). Physical assets live under
 * `/assets`.
 */
export const Route = createFileRoute('/_authed/inventory/items/$itemId')({
	component: ItemDetailPage,
});

function ItemDetailPage() {
	const { t } = useTranslation(['inventory', 'common']);
	const categoryNames = useItemCategoryNames();
	const { itemId } = useParams({ from: Route.id });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: item, isPending, isError } = useQuery(productQueryOptions(itemId));
	const { data: units } = useQuery(productSerialsQueryOptions(itemId));

	const [archiving, setArchiving] = useState(false);
	const canUpdate = usePermission('product.update');
	const setItem = (saved: TProduct) => queryClient.setQueryData(productQueryOptions(itemId).queryKey, saved);

	if (isPending) return null;

	if (isError || !item) {
		return (
			<AdminOnly>
				<p className='text-sm text-muted-foreground'>
					{t('inventory:detail.notFound')}
				</p>
			</AdminOnly>
		);
	}

	async function handleArchive() {
		setArchiving(true);
		try {
			await archiveProduct(itemId);
			toast.success(t('inventory:form.archived'));
			await queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
			void navigate({ to: '/inventory/products' });
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
							<Badge variant='outline'>{t(`inventory:kind.${item.productKind}`)}</Badge>
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
										{t('inventory:detail.archive')}
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{t('inventory:detail.archiveConfirm')}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{t('inventory:detail.archiveConfirmBody')}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										{t('common:action.cancel')}
									</AlertDialogCancel>
									<AlertDialogAction onClick={() => void handleArchive()}>
										{t('inventory:detail.archive')}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>

				<Card>
					<CardContent className='grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4'>
						<Detail
							label={t('inventory:items.category')}
							value={item.productCategoryId ? (categoryNames.get(item.productCategoryId) ?? null) : null}
						/>
						<Detail label={t('inventory:items.brand')} value={item.brand} />
						<Detail
							label={t('inventory:items.isActive')}
							value={item.isActive ? t('inventory:items.isActive') : t('inventory:items.inactive')}
						/>
						<Detail label={t('inventory:items.unitLabel')} value={item.unitLabel} />
						<Detail label={t('inventory:items.barcode')} value={item.barcode} />
						<Detail
							label={t('inventory:items.minStockQty')}
							value={item.minStockQty}
						/>
						<Detail
							label={t('inventory:items.sellingPrice')}
							value={String(item.sellingPrice)}
						/>
						<Detail
							label={t('inventory:items.purchasePrice')}
							value={String(item.purchasePrice)}
						/>
						<Detail
							label={t('inventory:items.tracking')}
							value={
								item.isSerialized
									? t('inventory:items.serialized')
									: t('inventory:items.quantityTracked')
							}
						/>
						<Detail
							label={t('inventory:items.description_label')}
							value={item.description}
						/>
					</CardContent>
				</Card>

				{item.specification && (
					<Card>
						<CardContent className='p-4 text-sm'>
							<div className='text-muted-foreground'>{t('inventory:items.specification')}</div>
							<p className='mt-1 whitespace-pre-line'>{item.specification}</p>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardContent className='p-4'>
						<DocumentImageField
							label={t('inventory:items.documentPhoto')}
							hint={t('inventory:items.documentPhotoHint')}
							imageUrl={item.imageUrl}
							disabled={!canUpdate}
							onUpload={async (file) => {
								setItem(await uploadDocumentImage<TProduct>(`/inventory/products/${itemId}/image`, file));
							}}
							onRemove={async () => {
								setItem(await removeDocumentImage<TProduct>(`/inventory/products/${itemId}/image`));
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
 * /inventory/products/:id/units` contract rejects an empty one, so the form can
 * no longer mint a `pre_order` unit with a provisional serial. Provisional
 * serials that already exist (from purchasing) can still be replaced exactly
 * once, and the replace control is only offered while the unit is provisional.
 */
function UnitsPanel({ itemId, units }: { itemId: string; units: TProductSerial[] }) {
	const { t } = useTranslation(['inventory', 'common']);
	const queryClient = useQueryClient();
	const [serial, setSerial] = useState('');
	const [registering, setRegistering] = useState(false);

	async function refresh() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: productSerialsQueryOptions(itemId).queryKey,
			}),
			queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] }),
		]);
	}

	async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRegistering(true);
		try {
			await registerSerial(itemId, {
				serialNumber: serial.trim(),
				status: 'in_stock',
			});
			toast.success(t('inventory:unit.registered'));
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

	async function handleReplace(unitId: string, nextSerial: string) {
		try {
			await replaceProvisionalSerial(itemId, unitId, nextSerial);
			toast.success(t('inventory:unit.replaced'));
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t('common:error.failed'),
			);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('inventory:detail.units')}</CardTitle>
				<CardDescription>
					{t('inventory:unit.newDescription')}
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<form onSubmit={handleRegister} className='flex items-end gap-2'>
					<div className='flex flex-1 flex-col gap-1'>
						<label htmlFor='serial' className='text-xs text-muted-foreground'>
							{t('inventory:unit.serialNumber')}
						</label>
						<Input
							id='serial'
							required
							value={serial}
							onChange={(event) => setSerial(event.target.value)}
						/>
						<span className='text-xs text-muted-foreground'>
							{t('inventory:unit.serialNumberHint')}
						</span>
					</div>
					<Button type='submit' disabled={registering}>
						{registering
							? t('inventory:unit.registering')
							: t('inventory:unit.register')}
					</Button>
				</form>

				{units.length === 0 ? (
					<p className='text-sm text-muted-foreground'>
						{t('inventory:detail.unitsEmpty')}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('inventory:detail.serialNumber')}</TableHead>
								<TableHead>{t('inventory:detail.status')}</TableHead>
								<TableHead>{t('inventory:detail.assetTag')}</TableHead>
								<TableHead className='text-right'>
									{t('inventory:unit.replaceSerial')}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{units.map((unit) => (
								<TableRow key={unit.id}>
									<TableCell className='font-mono text-xs'>
										{unit.serialNumber}
										{unit.isProvisionalSerial && (
											<Badge variant='outline' className='ml-2'>
												{t('inventory:detail.provisional')}
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<Badge variant='secondary'>
											{t(`inventory:status.${unit.status}`)}
										</Badge>
									</TableCell>
									<TableCell className='text-muted-foreground'>
										{unit.assetTag ?? '—'}
									</TableCell>
									<TableCell className='text-right'>
										{unit.isProvisionalSerial ? (
											<ReplaceSerialButton
												onReplace={(nextSerial) =>
													void handleReplace(unit.id, nextSerial)
												}
											/>
										) : (
											'—'
										)}
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

/** Inline dialog that collects the real serial for a pre-ordered unit. */
function ReplaceSerialButton({
	onReplace,
}: {
	onReplace: (serialNumber: string) => void;
}) {
	const { t } = useTranslation(['inventory', 'common']);
	const [value, setValue] = useState('');

	return (
		<AlertDialog>
			<AlertDialogTrigger
				render={
					<Button variant='ghost' size='sm'>
						{t('inventory:unit.replaceSerial')}
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('inventory:unit.replaceSerial')}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('inventory:unit.replaceSerialBody')}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Input
					value={value}
					placeholder={t('inventory:unit.serialNumber')}
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
