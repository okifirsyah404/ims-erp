import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { SupplierFormDialog } from '@/components/procurement/supplier-form-dialog';
import { toast } from '@/components/toast';
import { setSupplierActive, supplierQueryOptions, updateSupplier } from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

/** `/procurement/suppliers/$supplierId` — one supplier. */
export const Route = createFileRoute('/_authed/procurement/suppliers/$supplierId')({
	component: SupplierDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

function SupplierDetailPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const { supplierId } = Route.useParams();
	const queryClient = useQueryClient();
	const canUpdate = usePermission('supplier.update');
	const canArchive = usePermission('supplier.archive');
	const canSeeBank = usePermission('supplier.read_bank');
	const [editing, setEditing] = useState(false);
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(supplierQueryOptions(supplierId));

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['procurement', 'suppliers'] });
			toast.success(message);
			setEditing(false);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	}

	if (isPending) return null;
	if (isError) return <p className='text-sm text-destructive'>{error.message}</p>;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/procurement/suppliers' className='text-sm text-muted-foreground hover:underline'>
				{t('procurement:suppliers.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.name}</h1>
					<div className='mt-1 flex items-center gap-2 text-sm text-muted-foreground'>
						{data.code}
						<Badge variant={data.status === 'active' ? 'default' : 'outline'}>{t(`common:status.${data.status}`)}</Badge>
					</div>
				</div>
				<div className='flex gap-2'>
					{canUpdate && (
						<Button variant='outline' onClick={() => setEditing(true)}>
							{t('common:action.edit')}
						</Button>
					)}
					{canArchive && (
						<Button
							variant='outline'
							disabled={busy}
							onClick={() =>
								void run(
									() => setSupplierActive(supplierId, data.status !== 'active'),
									data.status === 'active' ? t('procurement:suppliers.deactivated') : t('procurement:suppliers.activated'),
								)
							}
						>
							{data.status === 'active' ? t('procurement:suppliers.deactivate') : t('procurement:suppliers.activate')}
						</Button>
					)}
				</div>
			</div>
			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:suppliers.identity')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('procurement:supplier.supplierType')} value={t(`procurement:supplierType.${data.supplierType}`)} />
						<Detail label={t('procurement:supplier.legalName')} value={data.legalName} />
						<Detail label={t('procurement:supplier.taxId')} value={data.taxId} />
						<Detail label={t('procurement:supplier.website')} value={data.website} />
						<Detail label={t('procurement:supplier.email')} value={data.email} />
						<Detail label={t('procurement:supplier.phone')} value={data.phone} />
						<Detail label={t('procurement:supplier.addressLine')} value={[data.addressLine, data.postalCode].filter(Boolean).join(' ')} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('procurement:suppliers.purchasing')}</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
						<Detail label={t('procurement:supplier.picName')} value={[data.picName, data.picTitle && `(${data.picTitle})`].filter(Boolean).join(' ')} />
						<Detail label={t('procurement:supplier.picPhone')} value={data.picPhone} />
						<Detail label={t('procurement:supplier.picEmail')} value={data.picEmail} />
						<Detail label={t('procurement:supplier.paymentTermsDays')} value={String(data.paymentTermsDays)} />
						<Detail label={t('procurement:supplier.paymentTermNote')} value={data.paymentTermNote} />
						{data.bankVisible && (
							<Detail
								label={t('procurement:suppliers.bank')}
								value={[data.bankName, data.bankAccountNumber, data.bankAccountHolder].filter(Boolean).join(' · ')}
							/>
						)}
					</CardContent>
				</Card>
			</div>
			{editing && (
				<SupplierFormDialog
					supplier={data}
					canSeeBank={canSeeBank}
					submitting={busy}
					onClose={() => setEditing(false)}
					onSave={(input) => void run(() => updateSupplier(supplierId, input), t('procurement:suppliers.saved'))}
				/>
			)}
		</div>
	);
}
